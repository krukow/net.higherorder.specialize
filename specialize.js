//The MIT License
//
//Copyright (c) 2008 Karl Krukow <karl.krukow@gmail.com>
//
//Permission is hereby granted, free of charge, to any person obtaining a copy
//of this software and associated documentation files (the "Software"), to deal
//in the Software without restriction, including without limitation the rights
//to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//copies of the Software, and to permit persons to whom the Software is
//furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in
//all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//THE SOFTWARE.

namespace('net.higherorder.jeene');

using(net.higherorder.jeene).run(function(j){
    
    var make_specializer = function (conf) {
        var scope,
            symbol_table = {},
            token,
            tokens,
            token_nr,
            itself = function () {return this;},
            co = j.CodeGen;
            
        conf = conf || {assoc:true};//+ associative by default
    
       
    
        var original_scope = {
            define: function (n) {
                var t = this.def[n.value];
                if (typeof t === "object") {
                    error(t.reserved ? "Already reserved." : "Already defined.",n);
                }
                this.def[n.value] = n;
                n.reserved = false;
                n.nud      = itself;
                n.led      = null;
                n.std      = null;
                n.lbp      = 0;
                n.scope    = scope;
                return n;
            },
            find: function (n) {
                var e = this, o;
                while (true) {
                    o = e.def[n];
                    if (o) {
                        return o;
                    }
                    e = e.parent;
                    if (!e) {
                        return symbol_table[symbol_table.hasOwnProperty(n) ?
                                n : "(name)"];
                    }
                }
            },
            pop: function () {
                scope = this.parent;
            },
            reserve: function (n) {
                if (n.arity !== "name" || n.reserved) {
                    return;
                }
                var t = this.def[n.value];
                if (t) {
                    if (t.reserved) {
                        return;
                    }
                    if (t.arity === "name") {
                        error("Already defined.",n);
                    }
                }
                this.def[n.value] = n;
                n.reserved = true;
            }
        };

        var new_scope = function () {
            var s = scope;
            scope = object(original_scope);
            scope.def = {};
            scope.parent = s;
            return scope;
        };

        var advance = function (id) {
            var a, o, t, v,
                spd = {st:false},//specialization denotation
                cod,//code denotation
                cur;
            if (id && token.id !== id) {
                error("Expected '" + id + "'.",token);
            }
            cur = token;
            if (token_nr >= tokens.length) {
                token = symbol_table["(end)"];
                return cur;
            }
            t = tokens[token_nr];
            token_nr += 1;
            v = t.value;
            a = t.type;
            cod = co.lambda(v);//default cod is itself
            if (a === "name") {
                o = scope.find(v);
            } else if (a === "operator") {
                o = symbol_table[v];
                if (!o) {
                    error("Unknown operator.",t);
                }
            } else if (a === "string" || a ===  "number") {
                o = symbol_table["(literal)"];
                a = "literal";
                spd.st = true;
                spd.val = v;
                cod = co.lambda(co.lit(v));
            } else {
                error("Unexpected token.",t);
            }
            token = object(o);
            token.from  = t.from;
            token.to    = t.to;
            token.value = v;
            token.arity = a;
            if (spd.st || !token.spd) {
                token.spd = spd;
            }
            if (!token.cod) {
                token.cod = cod;
            }
            return cur;
        };

        var expression = function (rbp) {
            var t = advance(),
            left = t.nud();
            while (rbp < token.lbp) {
                t = advance();
                left = t.led(left);
            }
            return left;
        };

        var statement = function () {
            var n = token, v;

            if (n.std) {
                advance();
                scope.reserve(n);
                return n.std();
            }
            v = expression(0);
            if (!v.assignment) {
                error("Bad expression statement.",v);
            }
            advance(";");
            return v;
        };

        var statements = function () {
            var a = [], s;
            while (true) {
                if (token.id === "}" || token.id === "(end)") {
                    break;
                }
                s = statement();
                if (s) {
                    a.push(s);
                }
            }
            return a.length === 0 ? null : a.length === 1 ? a[0] : a;
        };

        var block = function () {
            return advance("{").std();
        };
        
        var fixedpoint = function(tok) {
            if (typeof tok.reduce !== 'function') {return tok;}
            var res = tok.reduce();
            while(res.change && typeof res.val.reduce === 'function') {
                res = res.val.reduce();
            }
            return res.val;
        };
    

        var original_symbol = {
            nud: function () {
                error("Undefined.",this);
            },
            led: function (left) {
                error("Missing operator.",this);
            }
        };

        var symbol = function (id, bp) {
            var s = symbol_table[id];
            bp = bp || 0;
            if (s) {
                if (bp >= s.lbp) {
                    s.lbp = bp;
                }
            } else {
                s = object(original_symbol);
                s.id = s.value = id;
                s.lbp = bp;
                symbol_table[id] = s;
            }
            return s;
        };

        var constant = function (s, v) {
            var x = symbol(s);
            x.nud = function () {
                scope.reserve(this);
                this.value = symbol_table[this.id].value;
                this.arity = "literal";
                this.spd = {st: true, val: this.value};
                return this;
            };
            x.value = v;
            return x;
        };
    

        var infix = function (id, bp, spec) {
            var s = symbol(id, bp);
            s.led = spec && spec.led || function (left) {
                this.first = left;
                this.second = expression(bp);
                this.arity = "binary";
                this.reduce = spec.reduce;
                return fixedpoint(this);
            };
            return s;
        };
        
        var infixr = function (id, bp, spec) {
            var s = symbol(id, bp);
            s.led = spec && spec.led || function (left) {
                this.first = left;
                this.second = expression(bp - 1);
                this.arity = "binary";
                this.reduce = spec.reduce;
                return fixedpoint(this);
            };
            return s;
        };

        //missing
        var assignment = function (id) {
            return infixr(id, 10, {
                led: function (left) {
                  if (left.arity !== 'name' && left.id!=="." && left.id!=='[') {//not ".", "[", "(name)"
                      error("Bad lvalue.",left);
                  }
                  this.first = left;
                  this.second = expression(9);
                  this.assignment = true;
                  this.arity = "binary";
                  var l = this.first,
                      r = this.second;
                  if (l.arity === 'name') {
                      if (r.spd.st) {
                          this.spd = l.spd = {st:true, val:r.spd.val};
                          l.cod = co.lambda(co.lit(r.spd.val));
                          this.cod = function(){};//no code for static assignments
                          l = scope.find(l.value);
                          l.spd = {st: true, val: this.spd.val};
                          l.cod = co.lambda(co.lit(this.spd.val));
                      } else {
                          //revoke static status 
                          this.spd = l.spd = {st:false};
                          this.cod = co.lambda({
                              vs:[l.value, this.id, r.cod,';']
                          });
                          l = scope.find(l.value);
                          l.spd = {st: false};
                          l.cod = co.lambda(l.value);
                      }
                      
                  }
                  else {
                      this.spd = {st:false};
                      this.cod = co.lambda({
                          vs:[l.value, this.id, r,';']
                      });
                  }
                  return this;
                }
            });
        };

        var prefix = function (id, spec) {
            var s = symbol(id);
            s.nud = spec && spec.nud || function () {
                scope.reserve(this);
                this.first = expression(70);
                this.arity = "unary";
                this.reduce = spec.reduce;
                return fixedpoint(this);
            };
            return s;
        };

        var stmt = function (s, f) {
            var x = symbol(s);
            x.std = f;
            return x;
        };

        symbol("(end)");
        symbol("(name)");
        symbol(":");
        symbol(";");
        symbol(")");
        symbol("]");
        symbol("}");
        symbol(",");
        symbol("in");
        symbol("else");

        constant("true", true);
        constant("false", false);
        constant("null", null);
        constant("pi", 3.141592653589793);
        constant("Object", {});
        constant("Array", []);

        symbol("(literal)").nud = itself;

        symbol("this").nud = function () {
            scope.reserve(this);
            this.arity = "this";
            return this;
        };

        assignment("=");
        assignment("+=");//missing
        assignment("-=");//missing

        infix("?", 20, {
            led: function (left) {
                this.first = left;
                this.second = expression(0);
                advance(":");
                this.third = expression(0);
                this.arity = "ternary";
                if (this.first.spd.st) {
                    if (this.first.spd.val) {
                        if (this.second.spd.st) {
                            this.spd = {st:true,val:this.second.spd.val};
                        }
                    } else {
                        if (this.third.spd.st) {
                            this.spd = {st:true,val:this.third.spd.val};
                        }
                    }
                }
                return this;
            }
        });

        infixr("&&", 32,{
            reduce: function() {
                var l = this.first,
                    r = this.second,
                    a = l.spd,
                    b = r.spd;
                if (a.st) {
                    if (a.val) {
                        if (b.st) {
                            this.spd = {st:true,val:b.val};
                            this.cod = co.lambda(co.lit(this.spd.val));
                            return {change: false, val:this};
                        }
                        return {change:true, val:r};
                    } 
                    else {
                        this.spd = {st: true, val:a.val};
                        this.cod = co.lambda(co.lit(this.spd.val));
                        return {change:false, val:this};
                    }
                }
                this.spd = {st:false};
                this.cod = co.lambda({
                      vs: [l, " " +this.id+ " ", r],
                      brack: true
                });
                return {change:false, val:this};
            }
        });
        infixr("||", 30,{
            reduce: function() {
                var l = this.first,
                    r = this.second,
                    a = l.spd,
                    b = r.spd;
                if (a.st) {
                    if (a.val) {
                        this.spd = {st: true, val:a.val};
                        this.cod = co.lambda(co.lit(this.spd.val));
                        return {change:false, val:this};
                    }
                    else {
                        if (b.st) {
                            this.spd = {st:true,val:b.val};
                            this.cod = co.lambda(co.lit(this.spd.val));
                            return {change: false, val:this};
                        }
                        return {change:true, val:r};
                    }
                }
                this.spd = {st:false};
                this.cod = co.lambda({
                      vs: [l, " " +this.id+ " ", r],
                      brack: true
                });
                return {change:false, val:this};
            }
        });

        infixr("===", 40);
        infixr("!==", 40);
        infixr("<", 40);
        infixr("<=", 40);
        infixr(">", 40);
        infixr(">=", 40);

        infix("+", 50,{
            reduce: function() {
                var l = this.first,
                    r = this.second,
                    a = l.spd,
                    b = r.spd;
                if (a.st && b.st) {
                    this.spd = {st:true, val:a.val + b.val};
                    this.cod = co.lambda(co.lit(this.spd.val));
                    return {change:false, val:this};
                }
                if (conf.assoc !== false) {//for a more efficient version make this check earlier
                    if (a.st && r.id === '+' && r.first.spd.st) {
                        r.first.value = r.first.spd.val = l.spd.val + r.first.spd.val;
                        r.first.cod = co.lambda(co.lit(r.first.value));
                        return {change: true, val: r};
                    }
                    if (b.st && l.id === '+' && l.second.spd.st) {
                        l.second.value = l.second.spd.val = l.second.spd.val + b.val;
                        l.second.cod = co.lambda(co.lit(l.second.value));
                        return {change: true, val: l};
                    }
                    
                }
                this.spd = {st:false};
                this.cod = co.lambda({
                      vs: [l, " + ", r],
                      brack: true
                });
                return {change:false, val:this};
            }
        });
        infix("-", 50,{
            reduce: function() {
                var l = this.first,
                    r = this.second,
                    a = l.spd,
                    b = r.spd;
                if (a.st && b.st) {
                    this.spd = {st:true, val:a.val - b.val};
                    this.cod = co.lambda(co.lit(this.spd.val));
                    return {change:false, val:this};
                }
                this.spd = {st:false};
                this.cod = co.lambda({
                      vs: [l, " "+this.id+" ", r],
                      brack: true
                });
                return {change:false, val:this};
            }
        });

        infix("*", 60);
        infix("/", 60);

        infix(".", 80, function (left) {
            this.first = left;
            if (token.arity !== "name") {
                error("Expected a property name.",token);
            }
            token.arity = "literal";
            this.second = token;
            this.arity = "binary";
            advance();
            return this;
        });

        infix("[", 80, function (left) {
            this.first = left;
            this.second = expression(0);
            this.arity = "binary";
            advance("]");
            return this;
        });

        infix("(", 80, function (left) {
            var a = [];
            if (left.id === "." || left.id === "[") {
                this.arity = "ternary";
                this.first = left.first;
                this.second = left.second;
                this.third = a;
            } else {
                this.arity = "binary";
                this.first = left;
                this.second = a;
                if ((left.arity !== "unary" || left.id !== "function") &&
                    left.arity !== "name" && left.id !== "(" &&
                    left.id !== "&&" && left.id !== "||" && left.id !== "?") {
                    error("Expected a variable name.",left);
                }
            }
            if (token.id !== ")") {
                while (true)  {
                    a.push(expression(0));
                    if (token.id !== ",") {
                        break;
                    }
                    advance(",");
                }
            }
            advance(")");
            return this;
        });


        prefix("!",{
            reduce: function(){
                var i = this.first,
                    spd = i.spd;
                if (spd.st) {
                    this.spd = {st:true, val:! spd.val};
                    this.cod = co.lambda(co.lit(this.spd.val));
                    return {change:false, val: this};
                }
                this.spd = {st:false};
                this.cod = co.lambda({
                    vs:[this.id,i],
                    brack:true
                });
                return {change:false, val:this};
            }
        });
        prefix("-");
        prefix("typeof");

        prefix("(", {
            nud: function () {
                var e = expression(0);
                advance(")");
                return e;
            }
        });

        prefix("function", {
            nud: function () {
                var a = [], t, first = true, code = [], vars = [];
                new_scope();
                if (token.arity === "name") {
                    scope.define(token);
                    this.name = token.value;
                    advance();
                }
                advance("(");
                code.push("function (");
                if (token.id !== ")") {
                    while (true) {
                        if (token.arity !== "name") {
                            error("Expected a parameter name.",token);
                        }
                        scope.define(token);
                        a.push(token);
                        if (!token.spd.st) {
                            code.push(token.value);
                            first = false;
                        } else {
                            vars.push(token.value);
                        }
                        t = token;
                        advance();
                  
                        if (token.id !== ",") {
                            break;
                        }
                        advance(",");
                        if (!token.spd.st && !first){
                            code.push(", ");
                        }
                    }
                }
                this.first = a;
                advance(")");
                code.push(")");
                advance("{");
                code.push("{");
                if (vars.length > 0) {
                  code.push("var ")
                  code.push(vars.join(', '));
                  code.push(";\n");
                }
                this.second = statements();
                if (this.second instanceof Array) {
                    each(this.second,function(x){
                       code.push(x); 
                    });
                }
                else {
                    code.push(this.second);
                }
                advance("}");
                code.push("}")
                this.cod = co.lambda({vs:code});
                this.arity = "function";
                scope.pop();
                return this;
            }
        });

        prefix("[", function () {
            var a = [];
            if (token.id !== "]") {
                while (true) {
                    a.push(expression(0));
                    if (token.id !== ",") {
                        break;
                    }
                    advance(",");
                }
            }
            advance("]");
            this.first = a;
            this.arity = "unary";
            return this;
        });

        prefix("{", {
            nud: function () {
                var a = [], n, v;
                if (token.id !== "}") {
                    while (true) {
                        n = token;
                        if (n.arity !== "name" && n.arity !== "literal") {
                            error("Bad property name.",token);
                        }
                        advance();
                        advance(":");
                        v = expression(0);
                        v.key = n.value;
                        a.push(v);
                        if (token.id !== ",") {
                            break;
                        }
                        advance(",");
                    }
                }
                advance("}");
                this.first = a;
                this.arity = "unary";
                return this;
            }
        
        });


        stmt("{",  function () {
            new_scope();
            var a = statements();
            advance("}");
            scope.pop();
            return a;
        });

        stmt("var", function () {
            var a = [], n, t;
            while (true) {
                n = token;
                if (n.arity !== "name") {
                    error("Expected a new variable name.",n);
                }
                scope.define(n);
                advance();
                if (token.id === "=") {
                    t = token;
                    advance("=");
                    t.first = n;
                    t.second = expression(0);
                    t.arity = "binary";
                    a.push(t);
                }
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
            advance(";");
            return a.length === 0 ? null : a.length === 1 ? a[0] : a;
        });

        stmt("if", function () {
            advance("(");
            this.first = expression(0);
            advance(")");
            this.second = block();
            if (token.id === "else") {
                scope.reserve(token);
                advance("else");
                this.third = token.id === "if" ? statement() : block();
            } else {
                this.third = null;
            }
            this.arity = "statement";
            return this;
        });

        stmt("return", function () {
            if (token.id !== ";") {
                this.first = expression(0);
            }
            advance(";");
            this.cod = co.lambda({vs:["return ", this.first, ";"]});
            if (token.id !== "}") {
                error("Unreachable statement.",token);
            }
            this.arity = "statement";
            return this;
        });

        stmt("break", function () {
            advance(";");
            if (token.id !== "}") {
                error("Unreachable statement.",token);
            }
            this.arity = "statement";
            return this;
        });

        stmt("while", function () {
            advance("(");
            this.first = expression(0);
            advance(")");
            this.second = block();
            this.arity = "statement";
            return this;
        });
    
        stmt("for", function(){
            var t;
            advance("(");
            if (token.arity !== "name") {
                error("'for (' must be followed by a variable name",token);
            }
            t = token;
            advance();
            this.first = t;
            advance("in"); 
            this.second = expression();
            advance(")");
            this.third = block();
            this.arity = "statement";
            return this;
        });

        return function (env) {
            var p, tok, source;
            co.code = [];
            source = typeof this.toSource === 'function' ? this.toSource() : this.toString();
            tokens = source.tokens('=<>!+-*&|/%^', '=<>&|');
            token_nr = 0;
            new_scope();
            for (p in env) {if (env.hasOwnProperty(p)) {
                    tok = scope.define({type: 'name', value: p});
                    tok.spd = {st: true, val: env[p]};
                    //handles only primitive values that represent themselves.
                    tok.cod = co.lambda(co.lit(env[p]));
                }}
            advance();
            var s = expression();
            advance("(end)");
            scope.pop();
            s.cod();
            var ie_bug;
            eval("ie_bug = ("+co.code.join("")+");");
            return ie_bug;
        };
    };

    j.Jeene = {
        make: make_specializer
    };
});