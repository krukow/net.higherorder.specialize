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

(function() {
	
    var Common = function() {
        /**
         * This function constructs and returns a new object, using the
         * <code>o</code> parameter as a prototype. This is equivalent to Crockford's 
         * object function.
         * 
         * @param {Object} o
         * @return a new object which has <code>o</code> as its prototype.
         */
        var object = (function() {
            function F() {}
            return function(o) {
                F.prototype = o;
                return new F();
            };
        })();
            
	
        /**
         * This function constructs a namespace using a namespace specification object. 
         * 
         * <h3>Example 1</h3>
         * <code>
         * com.trifork.common.Common.namespace({
         *    com: {
         *    	trifork: {
         *    		utils: {},
         *    		myapplication: ['model','view', 'controller']
         *      }
         *    }
         * });
         * </code>
         * 
         * <h3>Example 2</h3>
         * <code>
         * com.trifork.common.Common.namespace({
         *    B1:{}, B2:["B21","B22"]
         * },B);
         * </code>
         * Extends B with two properties: B1 and B2. B1 is an empty object, while B2 has two properties B21 and B22,
         * which in turn are empty objects.
         *  
         * @param {Object} spec a namespace specification
         * @param {Object} context (Optional) used to extend namespaces (see example 2 above): defaults to window.
         * @return the last deepest object in the defined namespace (in case spec is a string).
         */
        function namespace(spec,context) {
            var validIdentifier = /^(?:[a-zA-Z_]\w*[.])*[a-zA-Z_]\w*$/,
                i,N;
                context = context || window;
                spec = spec.valueOf();
            if (typeof spec === 'object') {
                if (typeof spec.length === 'number') {//assume an array-like object
                    for (i=0,N=spec.length;i<N;i++) {
                        namespace(spec[i],context);
                    }
                }
                else {//spec is a specification object e.g, {com: {trifork: ['model,view']}}
                    for (i in spec) if (spec.hasOwnProperty(i)) {
                        context[i] = context[i] || {};
                        namespace(spec[i], context[i]);//recursively descend tree
                    }
                }
            } else if (typeof spec === 'string') {
                (function handleStringCase(){
                    var parts;
                    if (!validIdentifier.test(spec)) {
                        throw new Error('"'+spec+'" is not a valid name for a package.');
                    }
                    parts = spec.split('.');
                    for (i=0,N=parts.length;i<N;i++) {
                        spec = parts[i];
                        context[spec] = context[spec] || {};
                        context = context[spec];
                    }
                })();
            }
            else {
                throw new TypeError();
            }
        }

			
        /**
         * Kind of a trivial function ;-) it is included for writing readable JavaScript which
         * uses packages. 
         * 
         * com.trifork.common.Common.using(X).run(f) is similar to f(X), 
         * but f is called with <code>this</code> set to X.
         * 
         * More precisely <code>com.trifork.common.Common.using(X).run(f)</code> is equivalent to
         * <code>f.call(X,X)</code>.
         * 
         * This provides a form of syntactic sugar.
         * 
         * Example: Suppose you've done <code>com.trifork.common.Common.namespace({Long:{Boring:"Namespace"}}});</code>
         * Now you want define an object in the Long.Boring.Namespace object, say Widget. Normally you would do
         * <code>
         *  Long.Boring.Namespace.Widget = function ()  {//constructor}
         *  Long.Boring.Namespace.prototype.fn1 = ...;
         *  Long.Boring.Namespace.prototype.fn2 = ...;
         * </code> 
         *  Alternatively you can do:
         * <code>
         * var shrt = Long.Boring.Namespace.Widget;
         * shrt.Widget ...
         * shrt.prototype.fn1...
         * </code>
         * But this breaks global namespace. Alternatively 
         * <code>
         * function() {
         * 	var shrt = Long.Boring.Namespace.Widget;
         *  ...
         * }();
         *  </code>
         * 
         * The <code>using</code> function is similar, it just reads nicer. For example.
         * <code>
         * com.trifork.common.Common.using(Long.Boring.Namespace).run(
         * function() {
         * 	this.Widget = ...;
         *  this.Widget.prototype.fn1 = ...;
         *  ...	
         * });
         * </code>
         * 
         * Alternatively you can let <code>fn</code> take a parameter which is bound to <code>ns</code> 
         * (so you can use that name instead of <code>this</code>).
         * Variable args: the namespace objects (i.e., package)
         * @return {Object} an object containing a run function which calls an input parameter <code>fn</code> 
         * with <code>arguments</code>.
         */
        function using() {
            var args = arguments;
            return {
                run: function(fn){
                    return fn.apply(args[0],args);
                }
            };
        }

        /**
         * Simply executes a function. Why would you want that?
         * 
         * Equivalent to using().run(fn)
         * 
         * Try reading:
         * 
         * var x = function() {//long code,
         * //several screens...
         * //now, is x a function or the result of applying this function?
         * ..
         * }();//we turned out applying it.
         * 
         * Instead
         * 
         * var x = inline(function(){...
         * 
         * });
         * @param {Function} fn the function to call
         * @param {[Object]} scope [Optional] parameter to set as 'this'
         * when calling fn.
         */
        function inline(fn,scope) {
            return scope?fn.call(scope):fn();
        }

        /**
         * Expose public methods
         */
        return {
            inline: inline,
            object: object,
            namespace:namespace,
            using: using
        };
    }();


    Common.namespace({
        com: {
            trifork: 'common'
        }
    });

    //extern com
    Common.using(com.trifork.common).run(function(c) {c.Common = Common;});

    namespace = Common.namespace;
    using = Common.using;
    object = Common.object;
    each = function(arr,f){
        for (var i=0,N=arr.length; i<N; i += 1) {
        f(arr[i]);
      }  
    };
    error = function (message, t) {
        t = t || this;
        t.name = "SyntaxError";
        t.message = message;
        throw t;
    };
})();
	
