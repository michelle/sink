import grammar, grammar_parser, re, sys, types, util
import pprint
import string
from util import Ambiguous

##-----------------------------------------------------------------------------
## Module interface
##

def makeRecognizer (gram, type='earley'):
    '''Construct and return a "recognizer" of GRAM.

    A recognizer is an object with a method recognize(inp), returning
    True if INP is a valid string in GRAM, and False otherwise.
    '''
    class Recognizer:
        def __init__ (self, parser):
            self.parser = parser

        def dump (self, f=sys.stdout):
            self.parser.dump (f)
 
        def recognize (self, inp):
            if self.parser.recognize(inp):
                return True
            return False

    return Recognizer (makeParser (gram, type))


def makeParser (gram, type='earley'):
    '''Construct and return a parser of GRAM.

    A parser is an object with a method parse(inp), returning the AST
    constructed from the parse tree of INP by the semantic actions in GRAM.
    '''
    if type == 'earley':
        return EarleyParser (gram)
    else:
        raise TypeError, 'Unknown parser type specified'

class TreeNode:
    def __init__ (self, label=None, value=None, children=[], actions=[]):
        self.label = label
        self.value = value
        self.val = None
        self.actions = actions
        self.children = children

    def evaluate (self):
        for child in self.children:
            child.evaluate()
        for action in self.actions:
            if action:
                # Epsilon!
                try:
                    if len(self.children) is 0:
                        self.val = action(self, *([{'val': ''}]))
                    else:
                        self.val = action(self, *(self.children))
                except TypeError:
                    util.error('Invalid SDT')
                    sys.exit(-1)
                except:
                    util.error('SDT went wrong!')
                    sys.exit(-1)
        if self.val is None:
            if len(self.children) > 0 or self.children is []:
                self.val = self.children[0].val
            else:
                self.val = self.label
        return self.val

    def getSize(self):
        if len(self.children) is 0:
            return 1
        else:
            total = 0
            for child in self.children:
                total += child.getSize()
            return total + 1

    def printStruct(self):
        print(self.label),
        if self.children is not None and len(self.children) is not 0:
            print(' -> [ '),
            for child in self.children:
                child.printStruct();
            print(' ], '),


##-----------------------------------------------------------------------------
## Earley Parser
##
class EarleyParser:
    '''A parser implementing the Earley algorithm.'''

    def __init__ (self, gram):
        '''Create a new Earley parser.'''
        self.grammar = gram
        self.terminals, self.invRenamedTerminals = EarleyParser.preprocess(gram)
        #print self.terminals
        #print self.invRenamedTerminals
        #self.dump()

    #def recognize (self, inp):
    def parse(self, inp):
        '''Return the result of parsing INP.'''

        # Tokenize the input
        try:
            tokens = self.tokenize (inp)
            TOKEN = 0; LEXEME = 1
        except Exception, pos:
            util.error ('Lexical error.  Cannot tokenize "at pos %s. Context:'\
                        ' %s"'% (pos, inp[pos[0]:pos[0]+24]))
            return False

        graph={}
        processed = {};
        parseTreeComplete = {}
        duplicates = {}
        self.unresolved = False
        self.resolved = False

        def tuplize(edge):
            if edge:
                (src, dst, (LHS, RHS, pos), children) = edge
                return (src, dst, (LHS, RHS, pos), tuple(children))
            return None

        def addEdge(e):
            (src, dst, (LHS, RHS, pos), children) = e
            if pos < len(RHS.RHS):
                N = RHS.RHS[pos]
            else:
                N = None

            if (dst, N) not in graph:
                graph[(dst, N)] = []

            processedkey = (src, dst, (LHS, RHS, pos), tuple(children[:-1]),
                    tuplize(children[-1].value) if len(children) > 0 else None)

            if processedkey not in processed:
                graph[(dst, N)].append(e)
                processed[processedkey] = 1
                # Put all non-terminals together!
                if N != None and N not in self.invRenamedTerminals:
                    if (dst, -1) not in graph:
                        graph[(dst, -1)] = []
                    graph[(dst, -1)].append(e)

                if N is None:
                    # Disambig?
                    if (src, dst, LHS) in parseTreeComplete:
                        (src, dst, (LHS, _RHS, _pos), old_children) = parseTreeComplete[(src, dst, LHS)].value
                        #print 'Ambiguous parse detected', (src, dst, LHS, _RHS) , (src, dst, LHS, RHS) 
                        (prec, assoc, dprec, prod) = RHS.info
                        (oldprec, oldassoc, olddprec, oldprod) = _RHS.info
                        replace = False
                        self.resolved = True
                        if prec is not None and oldprec is not None:
                            if prec is oldprec:
                                leftbig = children[0].getSize() > old_children[0].getSize()
                                #print children[0].getSize(), old_children[0].getSize()
                                if assoc == grammar.Grammar.LEFT_ASSOCIATIVE:
                                    #left assoc, we want left subtree larger
                                    replace = leftbig
                                else:
                                    replace = not leftbig
                                #print 'ASSOC', children[0].getSize(), old_children[0].getSize()
                                #print LHS
                            else:
                                replace = oldprec > prec
                                #print prec, oldprec
                                #print 'PRECENDENCE:', replace, children[1].label, old_children[1].label
                                #print 'PREC'
                        elif dprec is not None and olddprec is not None and dprec is not olddprec:
                            replace = dprec > olddprec
                        else:
                            #print 'UNRESOLVED'
                            self.unresolved = True
                        if replace:
                            node = TreeNode(LHS, e, children, RHS.actions)
                            parseTreeComplete[(src, dst, LHS)] = node
                            if _pos < len(_RHS.RHS):
                                _N = _RHS.RHS[_pos]
                            else:
                                _N = None
                            graph[(dst, _N)].remove((src, dst, (LHS, _RHS, _pos), old_children))
                            if (dst, -1) in graph:
                                if (src, dst, (LHS, _RHS, _pos), old_children) in graph[(dst, -1)]:
                                    graph[(dst, -1)].remove((src, dst, (LHS, _RHS, _pos), old_children))
                        else:
                            graph[(dst, N)].remove(e)

                    else:
                        parseTreeComplete[(src, dst, LHS)] = TreeNode(LHS, e, children, RHS.actions)



        # Add edge (0,0,(S -> . alpha)) to worklist, for all S -> alpha
        for P in self.grammar[self.grammar.startSymbol].productions:
            addEdge((0,0,(self.grammar.startSymbol,P,0), []))

        # for all tokens on the input
        for j in xrange(0,len(tokens)+1):

            # skip in first iteration; we'll complete and predict start nonterminal
            # before we start walking over input
            if j > 0:
                # ADVANCE across the next token:
                # for each edge (i,j-1,N -> alpha . inp[j] beta)
                #      add edge (i,j,N -> alpha inp[j] . beta)
                if (j - 1, tokens[j - 1][0]) in graph:
                    for (i, _j, (N, RHS, pos), children) in graph[(j - 1, tokens[j - 1][0])]:
                        addEdge((i, j, (N, RHS, pos + 1),
                                children + [TreeNode(tokens[j - 1][1])]))

            # Repeat COMPLETE and PREDICT until no more edges can be added
            graphSize = -1
            realSize = 0
            if (j, None) in graph:
                realSize += len(graph[(j, None)])
            if (j, -1) in graph:
                realSize += len(graph[(j, -1)])
                
            while graphSize < realSize:
                graphSize = realSize
                realSize = 0
                # COMPLETE productions
                # for each edge (i,j,N -> alpha .)
                #     for each edge (k,i,M -> beta . N gamma)
                #         add edge (k,j,M -> beta N . gamma)
                if (j, None) in graph:
                    edges = graph[(j, None)]
                    for (i, _j, (N, RHS, pos), children) in edges:
                        if (i, N) in graph:
                            for (k, _i, (M, RHS2, pos2), _children) in graph[(i, N)]:
                                addEdge((k, j, (M, RHS2, pos2 + 1),
                                        _children +
                                        [TreeNode(N,(i,j,(N,RHS,pos),children),children, RHS.actions)]))
                    realSize += len(edges)

                # PREDICT what the parser is to see on input (move dots in edges 
                # that are in progress)
                #
                # for each edge (i,j,N -> alpha . M beta)
                #      for each production M -> gamma
                #           add edge (j,j,M -> . gamma)
                if (j, -1) in graph:
                    for (i, _j, (N, RHS, pos), ignore) in graph[(j, -1)]: # -1 means incomplete.    
                        M = RHS.RHS[pos]
                        # prediction: for all rules D->alpha add edge (j,j,.alpha)
                        if (j, M) not in duplicates:
                            duplicates[(j, M)] = True
                            for RHS in self.grammar[M].productions:
                                children = []
                                if RHS.RHS is ():
                                    children = [TreeNode('', None, '', [])]
                                addEdge((j, j, (M, RHS, 0), children))

                    realSize += len(graph[(j, -1)])

        def printEdges():
            e = []
            for node in parseTreeComplete.values():
                (src, dst, (LHS, prod, pos), children) = node.value
                e.append((src, dst, prod.toString(self.invRenamedTerminals)));
            e.sort()
            pprint.pprint(e)
        
        for RHS in self.grammar[self.grammar.startSymbol].productions:
            dst = len(tokens)
            if (dst, None) in graph:
                edges = graph[(dst, None)]
                if (0,dst,self.grammar.startSymbol) in parseTreeComplete:
                    #parseTreeComplete[(0,dst,self.grammar.startSymbol)].printStruct()
                    #print '\n\n'
                    #printEdges()
                    #if self.unresolved:
                    #    print ('Ambiguous, unresolved')
                    #elif self.resolved:
                    #    print ('Ambiguous, resolved')
                    return parseTreeComplete[(0,dst,self.grammar.startSymbol)].evaluate()
        util.error('Invalid Parse')
        sys.exit(-1)

        
    def tokenize (self, inp):
        '''Return the tokenized version of INP, a sequence of
        (token, lexeme) pairs.
        '''
        tokens = []
        pos = 0

        while True:
            matchLHS = 0
            matchText = None
            matchEnd = -1

            for regex, lhs in self.terminals:
                match = regex.match (inp, pos)
                if match and match.end () > matchEnd:
                    matchLHS = lhs
                    matchText = match.group ()
                    matchEnd = match.end ()

            if pos == len (inp):
                if matchLHS:  tokens.append ((matchLHS, matchText))
                break
            elif pos == matchEnd:       # 0-length match
                raise Exception, pos
            elif matchLHS is None:      # 'Ignore' tokens
                pass
            elif matchLHS:              # Valid token
                tokens.append ((matchLHS, matchText))
            else:                       # no match
                raise Exception, pos

            pos = matchEnd

        return tokens


    def dump (self, f=sys.stdout):
        '''Print a representation of the grammar to f.'''

        self.grammar.dump()

        for regex, lhs in self.terminals:
            if lhs is None:  lhs = '(ignore)'
            print lhs, '->', regex.pattern


    ##---  STATIC  ------------------------------------------------------------

    TERM_PFX = '*'     # prefix of nonterminals replacing terminals
    NONTERM_PFX = '@'  # prefix of nonterminals replacing RHSs with > 2 symbols

    @staticmethod
    def preprocess (gram):
        '''Returns the tuple:
         
        (
          [ (regex, lhs) ],             # pattern/token list
        )

        WARNING: modifies GRAM argument.
        '''

        REGEX = re.compile ('')
        
        terminals = []
        renamedTerminals = {}
        epsilons = []

        # Import all the grammar's modules into a new global object
        try:
            glob = util.doImports (gram.imports)
        except Exception, e:
            util.error ('problem importing %s: %s' % (gram.imports, str(e)))
            sys.exit(1)

        # Add 'ignore' patterns to the terminals list
        for regex in gram.ignores:
            terminals.append ((regex, None))

        # Add 'optional' patterns to the terminals list
        for sym, regex in gram.optionals:
            terminals.append ((regex, sym))

        # Build a lookup table for operator associativity/precedences
        operators = {}
        for op, prec, assoc in gram.getAssocDecls ():
            operators [op.pattern] = (prec, assoc)

        # First pass -- pull out epsilon productions, add terminal rules
        # and take care of semantic actions
        ruleNum = 0                     # newly-created rules
        for rule in gram.rules:
            lhs = rule.lhs
            for production in rule.productions:
                actions = production.actions
                rhs = list(production.RHS)

                # Create the S-action, if specified
                if actions[len (rhs)]:
                    actions[len (rhs)] = EarleyParser.makeSemantFunc (
                        actions[len (rhs)], len (rhs), glob)

                # Pull out epsilons and terminals
                for i, sym in enumerate (rhs):
                    if sym == grammar.Grammar.EPSILON:
                        # Epsilon
                        assert len (rhs) == 1
                        rhs = [] # in Earley, we model empsilon as an empty rhs
                        production.RHS = []

                    elif type (sym) == type (REGEX):
                        # Terminal symbol
                        if sym.pattern in renamedTerminals:
                            # Terminal was already factored out
                            termSym = renamedTerminals[sym.pattern]
                        else:
                            # Add *N -> sym rule, replace old symbol
                            termSym = '%s%d'% (EarleyParser.TERM_PFX, ruleNum)
                            ruleNum += 1
                            renamedTerminals[sym.pattern] = termSym
                            terminals.append ((sym, termSym))

                        if sym.pattern in operators:
                            # This pattern has a global assoc/prec declaration
                            # (which might be overridden later)
                            prec, assoc = operators[sym.pattern]
                            production.opPrec = prec
                            production.opAssoc = assoc
                        rhs[i] = termSym

                    if actions[i]:
                        # I-action for this symbol
                        actions[i] = EarleyParser.makeSemantFunc (
                            actions[i], len (rhs), glob)

                production.RHS = tuple(rhs)

        # Second pass -- build the symbol mapping and collect parsing info
        ruleNum = 0
        for rule in gram.rules:
            for production in rule.productions:
                lhs = rule.lhs
                rhs = production.RHS

                if len (rhs) == 1 and rhs[0] == grammar.Grammar.EPSILON:
                    # Epsilon production, skip it
                    continue

                # Collect precedence/associativity info
                if production.assoc != None:
                    # This production had a %prec declaration
                    opPrec, assoc = operators[production.assoc.pattern]
                elif production.opPrec != None:
                    # This production had a terminal symbol with an assoc/prec
                    # declaration
                    opPrec = production.opPrec
                    assoc = production.opAssoc
                else:
                    # No declarations ==> undefined prec, assoc
                    opPrec, assoc = None, None

                # Collect dprec info
                if production.prec != -1:
                    # Production had a %dprec declaration
                    dprec = production.prec
                else:
                    # No declaration ==> undefined dprec
                    dprec = None

                # Information about this production to be used during parsing
                production.info = (opPrec, assoc, dprec, production)
        
        return terminals, dict([(new,orig) for (orig,new) in \
               renamedTerminals.iteritems()])


    @staticmethod
    def makeSemantFunc (code, numArgs, globalObject):
        args = ['n0']
        for i in xrange (numArgs):
            args.append ('n%d'% (i+1))
        try:
            return util.createFunction (util.uniqueIdentifier (),
                                        args, code, globalObject)
        except Exception, e:
            util.error ("couldn't create semantic function: " + str(e))
            sys.exit(1)

    @staticmethod
    def __isTermSymbol (sym):
        '''Return TRUE iff SYM is a 'virtual' nonterminal for a
        terminal symbol, created during grammar normalization.
        '''
        return sym[0] == EarleyParser.TERM_PFX


    @staticmethod
    def dumpEdges (edges):
        '''Print a representation of the edge set EDGES to stdout.'''
        for sym, frm, to in edges:
            print '(%d)--%s--(%d)'% (frm, sym, to)


    @staticmethod
    def dumpTree (tree, edges, level=0):
        '''Print a representation of the parse tree TREE to stdout.'''
        sym, frm, to = tree[0:3]
        if len (tree) > 3:
            children = tree[3]
        else:
            children = edges[(sym, frm, to)][3]
        if (isinstance (children, basestring) or
            children is grammar.Grammar.EPSILON):
            print '%s%s "%s")'% ('-'*level*2, sym, children)
        else:
            print '%s%s %d-%d'% ('-'*level*2, sym, frm, to)
            for child in children:
                EarleyParser.dumpTree (child, edges, level + 1)



# For instrumentation 
def incr(id):
    pass

if __name__ == '__main__':
    pass
