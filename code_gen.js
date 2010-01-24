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

using(net.higherorder.jeene).run(function(s){
    
    var QUOT = "\"",
        ESC_QUOT = "\\"+QUOT,
        append_value = function(v) {
            if (typeof v === 'function') {
                v();
            } else {//string
               s.CodeGen.code.push(v);
            }
    };
    
    s.CodeGen = {
        //will holde the residual program code (obtained as code.join(""))
        code: [],
        
        //for all primitive values v, eval(lit(v)) === v
        lit: function(l) {//literal is a string or another primitive
            return typeof l === 'string'? QUOT + l.replace(/"/g,ESC_QUOT) + QUOT 
                                        : String(l);
        },
        
        append: function(vs) {
            if (vs instanceof Array) {
                each(vs,append_value);
            }
            else {
                append_value(vs);
            }
        },
        //called with a value to produce a function which when called
        //will append that value to the code array
        //if spec has a vs property this is used as the value
        //and an optional brack property can be set to true
        //to ensure that the values are enclosed in parentheses
        //for example: (a - b) instead of a - b.
        lambda: function(spec) {
            var vs = spec.vs || spec, 
                values = [], 
                putValue = function(v) {
                  if (typeof v === 'function') {
                     values.push(v);
                  } else if (typeof v === 'object' && typeof v.cod === 'function') {
                     values.push(v.cod);
                  } else {
                     values.push(v);  
                  }
                };
                
            if (vs instanceof Array) {
                each(vs, putValue);
            } else {
                putValue(vs);
            }
            return spec.brack ? function() {
                  each(values, function(o){
                      if (typeof o === 'object') {
                          if (o.spd.st || o.arity === "literal" || o.arity === "name") {
                              append_value(o);   
                          } else {
                              append_value("(");
                              append_value(o);
                              append_value(")");
                          }
                      } else {
                          append_value(o);
                      }
                  });
            } 
            : function(){s.CodeGen.append(values);};
        }
    };
    
    
    
});
