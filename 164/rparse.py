#!/usr/bin/python
'''A small application for invoking the reference parser over its RESTful
web interface.
'''

import sys
import json
import webbrowser
import pprint
import pickle, hashlib
from itertools import chain
from optparse import OptionParser
from os.path import abspath
from urllib import urlencode
from urllib2 import urlopen

cache_name = 'cache.tmp'

def htmlencode(text):
    safe_text = str(text)
    entities = (('&', '&amp;'), ('<', '&lt;'), ('>', '&gt;'), ('"', '&quot;'))
    for entity in entities:
        safe_text = safe_text.replace(*entity)
    return safe_text

def evaluate_response(response, evaluate=False):
    if evaluate and (response is not None):
        environment = {}
        exec response in environment
        result = environment['result']
    else:
        result = response
    return result
    
def load_cache():
    cache = {}
    try:
        with open(cache_name, 'rb') as cache_file:
            cache = pickle.load(cache_file)
    except Exception:
        pass
    return cache
        
def write_cache(cache):
    with open(cache_name, 'wb+') as cache_file:
        try:
            pickle.dump(cache, cache_file)
        except:
            pass
            
def hash3(a, b, c):
    return hashlib.sha1(str(a) + str(b) + str(c)).hexdigest()
    
def print_output_and_evaluate_response(res):
    if 'output' in res:
        output = res['output']
        print >>sys.stderr, output
    if 'value' in res:
        answer = res['value']
        return evaluate_response(answer, evaluate=True)
    else:
        raise Exception('No value returned by parser.')

def remote_parse(inputs, lgrammar, rgrammar, server):
    cache = load_cache()
    hinputs = [(text, hash3(text, lgrammar, rgrammar)) for text in inputs]
    matches = filter(lambda x: x[1] in cache, hinputs)

    # Construct the URL query string.
    query_parameters = [('input', text) for (text, digest) in hinputs if digest not in cache]
    response = {}
    if query_parameters:
        if lgrammar:
            query_parameters.append(('grammar', lgrammar))
        elif rgrammar:
            query_parameters.append(('server_grammar', rgrammar))
        query = urlencode(query_parameters)
        response = json.load(urlopen(server, query))
    
    results = {}
    for t, h in matches:
        results[t] = print_output_and_evaluate_response(cache[h])
    for key in response:
        res = response[key]
        assert(type(res) == type({}))
        if 'error' in res:
            print res['error']
            results[key] = None
        else:
            try:
                results[key] = print_output_and_evaluate_response(res)
                cache[hash3(key, lgrammar, rgrammar)] = res
            except Exception as e:
                print 'Failed to evaluate SDT for input "{0}":'.format(key)
                print 'Exception: {0}'.format(e)
    write_cache(cache)
    return results

if __name__ == '__main__':
    server_url = 'https://cs164parser.appspot.com/parser'
    
    parser = OptionParser(usage='usage: %prog [options] input...')
    parser.add_option('-g', '--grammar', dest='grammar', metavar='GRAMMAR',
                      help=('read the grammar from GRAMMAR; '
                            'if unspecified, let the server choose a grammar'),
                      default='')
    parser.add_option('-r', '--remote_grammar', dest='remote_grammar',
                      metavar='REMOTE_GRAMMAR',
                      help=('read the grammar from the REMOTE_GRAMMAR file '
                            'that resides on the remote host'),
                      default='')
    parser.add_option('-s', '--server', dest='server', metavar='SERVER',
                      help='use SERVER as the remote service provider',
                      default=server_url)
    options, args = parser.parse_args()

    if not options.grammar and not options.remote_grammar:
        print 'Grammar (remote or local) required.'
        exit(-1)
    if options.grammar:
        with open(options.grammar) as grammar_file:
            options.grammar = grammar_file.read()
    if not args:
        inputs = [sys.stdin.read()]
    else:
        inputs = args

    results = remote_parse(inputs, options.grammar, options.remote_grammar, options.server)
    pp = pprint.PrettyPrinter(indent=4)
    for key in results:
        print 'AST for input "{0}":'.format(key)
        pp.pprint(results[key])
    exit(0)
