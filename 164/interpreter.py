# PA2: Bytecode interpreter for lambdas and coroutines.  Motivation: stackful
# interpreter cannot implement coroutines.  You are free to modify this file in
# any way you want as long as you do not change the interpreter invokation by
# main.py

import sys, getopt, re

###############################################################################
#                           BYTECODE COMPILER                                 #
###############################################################################
# The bytecode array stores instructions of the main scope; bytecode arrays
# for lambda bodies are nested bytecode arrays, stored in the call instruction

# Bytecode instruction
#   opcode: instuction type
#   ret:    return register
#   reg1:   register of first operand
#   reg2:   register of second operand
#   reg3:   register of third operand
#   args:   list of arguments
#   body:   code
#   callee: function to call
class BcInst(object): # Used for unary instructions
    def __init__(self, opcode, ret):
        self.opcode = opcode
        self.ret = ret
    def __str__(self):
        return '%s\t%s' % (self.opcode[:6], self.ret)

class BcInstStd(BcInst): # Used for most instructions
    def __init__(self, opcode, ret, reg1 = None, reg2 = None, reg3 = None):
        super(BcInstStd, self).__init__(opcode, ret)
        self.reg1 = reg1
        self.reg2 = reg2
        self.reg3 = reg3
    def __str__(self):
        [r1, r2, r3] = map(lambda r: r is None and ' ' or ', ' + str(r), \
                           [self.reg1, self.reg2, self.reg3])
        return '%s\t%s%s%s%s' % (self.opcode[:6], self.ret, r1, r2, r3)

class BcInstAux(BcInst): # Used for call and lambda
    def __init__(self, opcode, ret, args = None, body = None, callee = None):
        super(BcInstAux, self).__init__(opcode, ret)
        self.callee = callee
        self.body = body
        self.args = args
    def __str__(self):
        ex = self.callee is None and self.args or self.callee
        return '%s\t%s, %s' % (self.opcode[:6], self.ret, ex)

cnt = 0
def newTemp(prefix = '$'):
    global cnt
    cnt = cnt + 1
    return prefix + str(cnt)

def bytecode(e):
    def bc(e,t):
        t1, t2, t3 = newTemp(), newTemp(), newTemp()
        # e is a list of statements (body of function or outer level code)
        if type(e) == type([]):
            if (len(e) is 0):
                return [BcInst('null', t), BcInst('return', t)]
            else:
                #return reduce(lambda code,s: code+bc(s,t), e, [])
                exps = reduce(lambda code,s: code+bc(s,t), e[:-1], [])
                exps += bc(e[-1], t)
                exps += [BcInst('return', t)]
                return exps

        # e is an expression or a statement
        if type(e) == type(()):
            # Expressions
            if e[0] =='var':
                return [BcInstStd('def', None, t, e[1])]
            if e[0] in ['null', 'dict-lit']:
                return [BcInst(e[0], t)]
            if e[0] in ['int-lit', 'fp-lit', 'string-lit']:
                return [BcInstStd(e[0], t, e[1])]
            if e[0] in ['+', '-', '*', '/', '<', '>', '>=', '<=', '==', '!=', 'in', 'get']:
                return bc(e[1],t1) + bc(e[2],t2) + [BcInstStd(e[0], t, t1, t2)]
            if e[0] == 'ite':
                return bc(e[1],t1) + bc(e[2],t2) + bc(e[3],t3) + \
                       [BcInstStd(e[0], t, t1, t2, t3)]
            if e[0] == 'lambda':
                return [BcInstAux('lambda', t, e[1], bc(e[2],t1))]
            if e[0] == 'call':
                func = e[1]
                args = e[2]
                temps = [newTemp() for i in xrange(len(args))]
                temps2 = list(temps)
                return bc(func, t1) \
                    + reduce(lambda code, s: code + bc(s, temps2.pop(0)), args, []) \
                    + [BcInstAux('call', t, temps, None, t1)]
            if e[0] == 'len':        
                return bc(e[1],t1) + [BcInstStd('len', t, t1)]
            if e[0] == 'input':     
                return [BcInst('input', t)]
            # Added for coroutines:
            if e[0] == 'resume':
                return bc(e[1], t1) + bc(e[2], t2) + [BcInstStd('resume', t, t1, t2)]
            if e[0] == 'yield':
                return bc(e[1], t1) + [BcInstStd('yield', t, t1)]
            if e[0] == 'coroutine':
                return bc(e[1], t1) + [BcInstStd('coroutine', t, t1)]
            # Statements
            if e[0] == 'exp':
                return bc(e[1],t)
            #'type' for for loops
            if e[0] == 'type':
                return bc(e[1], t1) + [BcInstStd(e[0], t, t1)]
            # 'asgn' always write to user-defined vars
            if e[0] == 'asgn':
                return bc(e[2],t) + [BcInstStd('asgn', e[1], t)]
            if e[0] == 'put':        
                return bc(e[1],t1) + bc(e[2],t2) + bc(e[3],t3) + \
                       [BcInstStd('put',t1,t2,t3), BcInstStd('def', None,t,t1)]
            if e[0] == 'def':
                #print e
                return bc(e[2],t) + [BcInstStd('def', None, e[1], t)]
            if e[0] == 'print':
                return bc(e[1],t) + [BcInstStd('print', t)]
            if e[0] == 'error':
                return bc(e[1],t) + [BcInst('error', t)]
            if e[0] == 'native':
                return bc(e[1],t1) + bc(e[2],t2) + bc(e[3],t3) + [BcInstStd(e[0], t, t1, t2, t3)]
        raise SyntaxError("Illegal AST node %s " % str(e))
    t = newTemp()
    return t,bc(e,t)

def print_bytecode(p,indent=0):
    for inst in p:
        if inst.opcode != 'lambda':
            print >> sys.stderr, " "*8*indent, inst
        else:
            print >> sys.stderr, " "*8*indent, str(inst)
            print_bytecode(inst.body,indent+1)

def tcall_opt(insts):
    for i in insts:
        if (i.opcode == 'call'):
            idx = insts.index(i)
            if idx + 1 < len(insts) and insts[idx + 1].opcode == 'return':
                i.opcode = 'tcall'
        if i.opcode == 'lambda':
             tcall_opt(i.body)


###############################################################################
#                           BYTECODE INTERPRETER                              #
###############################################################################
class State:                        # The interpreter state.
    def __init__(self, stmts, env, pc = 0, callstack = None):
        self.stmts = stmts
        self.env = env
        self.pc = pc
        if callstack:
            self.callstack = callstack
        else:
            self.callstack = []

class Coroutine:
    def __init__(self, state, ret_var, is_finished=False):
        self.state = state
        self.ret_var = ret_var
        self.is_finished = is_finished

class ProgramError(Exception):      # Exception thrown for runtime-errors
    def __init__(self, msg):
        # Optional msg to be printed to stderr
        self.msg = msg
class ProgramEnd(Exception):
    def __init__(self, value):
        self.ret = value
class Fun:                          # The function: (ret-var, arg list, body)
    def __init__(self, argList, body):
        self.argList = argList
        self.body = body
    def __gt__(self):
        raise TypeError
    def __ge__(self):
        raise TypeError
    def __lt__(self):
        raise TypeError
    def __le__(self):
            raise TypeError
            
class FunVal:                       # Function value (a closure): (fun, env)
    def __init__(self, fun, env):
        self.fun = fun
        self.env = env
    def __gt__(self):
        raise TypeError
    def __ge__(self):
        raise TypeError
    def __lt__(self):
        raise TypeError
    def __le__(self):
        raise TypeError
        

# This is the main function of the bytecode interpreter.
# Error handling is missing from the skeleton.
def Resume(state):
    """ Arguments represent the state of the coroutine (as well as of the main
    program) stmts: array of bytecodes, pc: index into stmts where the
    execution should (re)start callstack: the stack of callign context of calls
    ppending in teh coroutine env: the current environment. """
    def lookup(name, env):
        #print "looking up" + str(name)
        try: return env[name]
        except:
            if env['__up__'] is None:
                raise ProgramError('Cannot find ' + name)
            return lookup(name, env['__up__'])

    def update(name,val,env):
        if name in env:
            env[name] = val
        else:
            if env['__up__']:
                update(name, val, env['__up__'])
            else:
                print 'Error'
                sys.exit(-1)
            
    def define(name, val):
        match = re.match("[a-zA-Z_][a-zA-Z_0-9]*", name)
        if name in state.env and match is not None:
            raise ProgramError('Redefinition of variable')
        state.env[name] = val

    def addScope(parentEnv):
        " create an empty scope and link it to parentEnv "
        return {'__up__': parentEnv}

    def execPrint(isError):
        v = lookup(inst.ret, state.env)
        update(inst.ret, None, state.env)
        if v == True:
            v = 1
        elif v == False:
            v = 0
        print v if v != None else "null" # None is a representation for null
        sys.stdout.flush()
        if (isError): sys.exit(1)

    def execGet():
        o = lookup(inst.reg1, state.env)
        k = lookup(inst.reg2, state.env)
        def get(obj):
            try: return obj[k]
            except KeyError:
                if ('__mt' in obj):
                    if ('__index' in obj['__mt']):
                        return get(obj['__mt']['__index'])
                    else:
                        return get(obj['__mt'])
                else:
                    raise ProgramError("164 Error: key '%s' not found in the dictionary" % k)
        define(inst.ret, get(o))

    def execPut():
        lookup(inst.ret, state.env)[lookup(inst.reg1, state.env)] = \
            lookup(inst.reg2, state.env)

    def execLen():
	obj = lookup(inst.reg1, state.env)
        if type(obj) == type({}):
            length = 0;
            try:
                while obj[length] != None:
                    length += 1
            except KeyError:
                pass
            define(inst.ret, length)
        elif type(obj) == type(""):
            define(inst.ret, len(obj))
        else:
            raise ProgramError("164 Error: called 'len' on object of %s (%s)" %\
                               (type(obj),obj))

    def execCall():
        # decompose the function value
        func = lookup(inst.callee, state.env)
        # Error handling for not calling a fn.
        # Quacks like a FunVal?
        if not isinstance(func, FunVal):
            raise ProgramError('Calling something that isn\'t a function.')
        fbody = func.fun.body
        fargs = func.fun.argList
        fenv = func.env

        if len(inst.args) != len(func.fun.argList):
            print "Error"
            sys.exit(1)
        
        arg_vals = []
        for a in inst.args:
            a = lookup(a, state.env)
            arg_vals.append(a)

        # Push to stack.
        state.callstack.append((state.env, inst.ret, state.pc, state.stmts))
        state.env = addScope(fenv)
        state.env.update(dict(zip(fargs, arg_vals)))

        # jump to body of the callee
        state.stmts = fbody  # each function has own list of statements (the body)
        state.pc = 0         # and its body starts at index 0

    def execTCall():
        # decompose the function value
        func = lookup(inst.callee, state.env)
        # Error handling for not calling a fn.
        # Quacks like a FunVal?
        if not isinstance(func, FunVal):
            raise ProgramError('Calling something that isn\'t a function.')

        fbody = func.fun.body
        fargs = func.fun.argList
        fenv = func.env

        if len(inst.args) != len(func.fun.argList):
            print "Error"
            sys.exit(1)
        
        arg_vals = []
        for a in inst.args:
            a = lookup(a, state.env)
            arg_vals.append(a)

        state.env = addScope(fenv)
        state.env.update(dict(zip(fargs, arg_vals)))
        state.stmts = fbody  # each function has own list of statements (the body)
        state.pc = 0         # and its body starts at index 0

    def execReturn():
        # ORDER: (env, ret, pc, stmts)
        ret = lookup(inst.ret, state.env)

        if len(state.callstack) == 0:
            raise ProgramEnd((ret, None, True))

        # Restore caller's context:
        #   - update the callstack
        #   - restore the caller's environment
        #   - handle return values
        (state.env, ret_var, state.pc, state.stmts) = state.callstack.pop()
        define(ret_var, ret)

    def execNative():
        module = lookup(inst.reg1, state.env)
        method = lookup(inst.reg2, state.env)
        args = lookup(inst.reg3, state.env)
        _m = __import__(module)
        define(inst.ret, getattr(_m, method)(**args))
    
    def execCoroutine():
        # Implement coroutine.  You must consider what information you
        # need to store for a coroutine.  This is of course dependent on how
        #p you implement resume and yield.
        func = lookup(inst.reg1, state.env)
        c_state = State(func.fun.body, { '__up__': func.env }, 0, [])
        if len(func.fun.argList) is not 1:
            raise ProgramError('Coroutine can only be created with a function that takes one argument.')

        coroutine = Coroutine(c_state, func.fun.argList[0])
        define(inst.ret, coroutine)

    def execResume():
        # Implement resume.  The second argument to resume is the
        # argument it passes to the coroutine.  You must ensure that you handle
        # the case where you try to resume a coroutine that has already ended.
        # In section, we discussed how you might use the Resume function of
        # this interpreter to handle coroutines.  What do you pass it?  How do
        # you handle its return value?
        co = lookup(inst.reg1, state.env)

        if co.is_finished:
            raise ProgramError('Coroutine already finished.')
        co.state.env[co.ret_var] = lookup(inst.reg2, state.env)
        result = Resume(co.state)
        (result, co.ret_var, co.is_finished) = result

        define(inst.ret, result)

    def execYield():
        # Implement yield.  The one parameter is an argument passed to
        # whomever resumed the coroutine.  Consider how you can store the
        # information necessary to allow the coroutine to be resumed later and
        # pick up in the right place.  In section, we discussed how to return
        # the information we have here back to whoever resumed this
        # coroutine.
        raise ProgramEnd((lookup(inst.reg1, state.env), inst.ret, False))
        
    def typeCheck():
        #Check if parameter is a list. The one parameter is a var
        #passed into reg1. check if 0 is in that var
        #FIXME return 1 if inst.reg1 contains a var that holds a list and not a function
        lst = lookup(inst.reg1, state.env)
        if type(lst) == type({}):
            define(inst.ret, 1)
        else:
            define(inst.ret, 0)
      
    def addOrConcat(reg1, reg2):
        try:
            return reg1 + reg2
        except :
            return unicode(reg1) + unicode(reg2)
    
    def checkBoolean(reg1):
        if isinstance(reg1, (int, long, float)) or reg1 is None:
            return reg1
        else:
            raise TypeError("Checking for incompatible boolean type")
            
    actions = {
        # represent 164 null with Python's None
        'null':      lambda: define(inst.ret, None),
        'string-lit':lambda: define(inst.ret, inst.reg1),
        'int-lit':   lambda: define(inst.ret, inst.reg1),
        'fp-lit':    lambda: define(inst.ret, inst.reg1),
        'dict-lit':  lambda: define(inst.ret, {}),
        'input':     lambda: define(inst.ret, raw_input()),
        '+':         lambda: define(inst.ret, addOrConcat(lookup(inst.reg1, state.env),  \
                                              lookup(inst.reg2, state.env))),
        '-':         lambda: define(inst.ret, lookup(inst.reg1, state.env) - \
                                              lookup(inst.reg2, state.env)),
        '*':         lambda: define(inst.ret, lookup(inst.reg1, state.env) * \
                                              lookup(inst.reg2, state.env)),
        '/':         lambda: define(inst.ret, lookup(inst.reg1, state.env) / \
                                              lookup(inst.reg2, state.env)),
        'def':       lambda: define(inst.reg1,lookup(inst.reg2, state.env)),
        '==':        lambda: define(inst.ret, lookup(inst.reg1, state.env) == \
                                              lookup(inst.reg2, state.env)),
        '!=':        lambda: define(inst.ret, lookup(inst.reg1, state.env) != \
                                              lookup(inst.reg2, state.env)),
        '>=':        lambda: define(inst.ret, lookup(inst.reg1, state.env) >= \
                                              lookup(inst.reg2, state.env)),
        '<=':        lambda: define(inst.ret, lookup(inst.reg1, state.env) <= \
                                              lookup(inst.reg2, state.env)),
        '>':        lambda: define(inst.ret, lookup(inst.reg1, state.env) > \
                                              lookup(inst.reg2, state.env)),
        '<':        lambda: define(inst.ret, lookup(inst.reg1, state.env) < \
                                              lookup(inst.reg2, state.env)),
        'in':        lambda: define(inst.ret, 1) if \
                             (lookup(inst.reg1, state.env) in \
                             lookup(inst.reg2, state.env)) else \
                             define(inst.ret, 0),
        'ite':       lambda: define(inst.ret, lookup(inst.reg2, state.env) if \
                                              checkBoolean(lookup(inst.reg1, state.env)) else \
                                              lookup(inst.reg3, state.env)),
        'lambda':    lambda: define(inst.ret, \
                             FunVal(Fun(inst.args,inst.body), state.env)),
        'asgn':      lambda: update(inst.ret, lookup(inst.reg1, state.env), \
                                    state.env),
        'print':     lambda: execPrint(False),
        'error':     lambda: execPrint(True),
        'native':    execNative,
        'get':       execGet,
        'put':       execPut,
        'len':       execLen,
        'call' :     execCall,
        'tcall' :    execTCall, # Extra credit (but fun): tail-call elimination.
        'return':    execReturn,
        'coroutine': execCoroutine,
        'resume':    execResume,
        'yield':     execYield,
        'type':      typeCheck
    }

    while True:
        inst = state.stmts[state.pc]
        state.pc = state.pc + 1
        try:
            actions[inst.opcode]()
        except ProgramEnd as e:
            return e.ret
        except ProgramError as e:
            print "Error"
            # Printing to stderr is not captured by the autograder
            print >> sys.stderr, e.msg
            sys.exit(1)
        except KeyError as e:
            raise SyntaxError(str(e) + ' not yet implemented')
        except SystemExit:
            sys.exit(1)
        except:
            print "Error"
            sys.exit(1)
    return NeverReached

def desugar(stmts):
    def desugarExp(e):
        if e[0] in ['resume', '+', '-', '*', '/', '<', '>', '>=', '<=', '==', '!=', 'in', 'get']:
            return (e[0], desugarExp(e[1]), desugarExp(e[2]))
        elif (e[0] == 'native'):
            e3 = desugarExp(e[3])
            return (e[0], e[1], e[2], e3)
        elif (e[0] == 'methodcall'):
            lbody = []
            lbody.append(('def', '$temp', e[1]))
            temp = e[3][:]
            temp.insert(0, ('var', '$temp'))
            lbody.append(('exp', ('call', ('get', ('var', '$temp'), e[2]), temp)))
            return ('exp', ('call', ('lambda', [], desugarStmts(lbody)), []))
        elif (e[0] == 'call'):
            e1 = desugarExp(e[1])
            dArgs = []
            for arg in e[2]:
                dArgs.append(desugarExp(arg))
            return (e[0], e1, dArgs)
        elif (e[0] == 'lambda'):
            return (e[0], e[1], desugarStmts(e[2]))
        elif (e[0] == 'ite'):
            e1 = desugarExp(e[1])
            e2 = desugarExp(e[2])
            e3 = desugarExp(e[3])
            return (e[0], e1, e2, e3)
        elif (e[0] == 'dict-lit'):
            if len(e[1]) == 0:
                return (e[0],[])

            inner = []
            inner.append(('def', '#dict', ('dict-lit',)))
            for init in e[1]:
                inner.append(('put', ('var', '#dict'), ('string-lit', init[0]),\
                             desugarExp(init[1]))) 
            inner.append(('exp', ('var', '#dict')))
            return ('exp', ('call', ('lambda', [], inner), []))
        elif e[0] in ['len', 'coroutine', 'yield']:
            return (e[0], desugarExp(e[1]))
        # Desugar && and || as spec suggests.
        # What should return values be?
        elif e[0] == '&&':
            t = ('lambda', [], [('exp', desugarExp(e[2]))])
            # False will always be 0.
            f = ('lambda', [], [('exp', ('int-lit', 0))])
            return ('call', ('ite', desugarExp(e[1]), t, f), [])
        elif e[0] == '||':
            # Will return the last true value evaluated.
            first = desugarExp(e[1])
            t = ('lambda', [], [('exp', first)])
            f = ('lambda', [], [('exp', desugarExp(e[2]))])
            return ('call', ('ite', first, t, f), [])
        elif e[0] == 'comprehension':
            lbody = []
            forBody = []
            body = desugarExp(e[1])
            forBody.append(('put', ('var', '$dict'), ('var', '$counter'), body))
            forBody.append(('asgn', '$counter', ('+', ('var', '$counter'), ('int-lit', 1))))
            lbody.append(('def', '$dict', ('dict-lit',[])))
            lbody.append(('def', '$counter', ('int-lit', 0)))
            lbody.append(('for', e[2], e[3], forBody))
            lbody.append(('exp', ('var', '$dict')))
            return ('exp', ('call', ('lambda', [], desugarStmts(lbody)), []))
        else:
            return e

    def desugarStmts(stmts):
        dStmts = []
        for s in stmts:
            if s[0] == 'exp' or s[0] == 'print' or s[0] == 'error':
                s1 = desugarExp(s[1])
                dStmts.append((s[0], s1))
            elif s[0] == 'put':
                dStmts.append((s[0], desugarExp(s[1]), desugarExp(s[2]), desugarExp(s[3])))
            elif s[0] == 'asgn' or s[0] == 'def':
                s2 = desugarExp(s[2])
                dStmts.append((s[0], s[1], s2))
            elif s[0] == 'fdef':
                s3 = desugarStmts(s[3])
                body = ('lambda', s[2], s3)
                dStmts.append(('def', s[1], body))
            elif s[0] == 'if':
                cond = desugarExp(s[1])
                body1 = ('lambda', [], desugarStmts(s[2]))
                if s[3] is not None:
                    body2 = ('lambda', [], desugarStmts(s[3]))
                else:
                    body2 = ('lambda', [], [])
                call = ('call', ('ite', cond, body1, body2), [])
                dStmts.append(('exp', call))
            elif s[0] == 'while':
                cond = ('lambda', [], [('exp', desugarExp(s[1]))])
                body = ('lambda', [], desugarStmts(s[2]))
                s1 = ('def', 'x', ('call', ('var', 'e'), []))
                # Why do we need two ifs?
                s2 = ('if', ('var', 'x'), [('exp', ('call', ('var', 'body'),
                    []))], [])
                s3 = ('if', ('var', 'x'), [('exp', ('call', ('var', 'while'),
                    [('var', 'e'), ('var', 'body')]))], [])
                whilebody = [s1, s2, s3]
                whiledef = ('def', 'while', ('lambda', ['e', 'body'],
                    desugarStmts(whilebody)))
                fn = ('lambda', ['e', 'body'], [whiledef, ('exp', ('call', ('var',
                    'while'), [('var', 'e'), ('var', 'body')]))])
                dStmts.append(('exp', ('call', fn, [cond, body])))
            elif s[0] == 'for':
                #TODO allow for to iterate over lists as well as iter functions
                cond = desugarExp(s[2])
                assignment1 = ('def', '$t1', cond)
                assignment2 = ('def', '$loopvar', ('call', ('var', '$t1'), []))
                #Code for iter
                iter = []
                iterBody = ('lambda', [], [('def', '$i', ('int-lit', 0)), ('exp', ('lambda', [], [('if', ('in', ('var', '$i'), s[2]), [('asgn', '$i', ('+', ('var', '$i'), ('int-lit', 1))), ('exp', ('get', s[2], ('-', ('var', '$i'), ('int-lit', 1))))], [('exp', ('null',))])]))])
                iter.append(('asgn', '$t1', ('call', iterBody, [])))
                listCheck = ('if', ('type', cond), iter, None)
                #end code for iter
                body =  [('def', s[1], ('var', '$loopvar'))] + desugarStmts(s[3])
                body.append(('asgn', '$loopvar', ('call', ('var', '$t1'), [])))
                whilecond = ('!=', ('var', '$loopvar'), ('null',))
                forBody = [assignment1, listCheck, assignment2, desugarStmts([('while', whilecond, body)]).pop(0)]
                call = ('call', ('lambda', [], desugarStmts(forBody)), [])
                dStmts.append(('exp', call))
            else:
                dStmts.append(s)
        return dStmts
    return desugarStmts(stmts)

# Global environment.  Persists across invocations of the ExecGlobal function
globEnv = {'__up__':None}

def Exec(stmts):
    """ Execute a sequence of statements at the outermost level"""
    env = {'__up__':None}
    return Resume(State(stmts, env)) # return the last statement's value

def ExecFun(closure, args):
    """ Execute a function with arguments args."""
    env = dict(zip(closure.fun.argList,args))
    env['__up__'] = closure.env
    return Resume(State(closure.fun.body, env))

def ExecFunByName(stmts, funName, args):
    """ Execute stmts and then call function with name 'funName'
        with argumetns args.  The function definition must be among
        the statements. """
    env = {'__up__':None}
    Resume(State(stmts, env))
    return ExecFun(env[funName],args)

def ExecGlobal(ast, bindings = {}):
    globEnv.update(bindings) # Add this at the very beginning of the function.
    bc = bytecode(desugar(ast))[1]
    tcall_opt(bc)
    #print_bytecode(bc)
    Resume(State(bc, globEnv))
