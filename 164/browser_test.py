#!/usr/bin/python
import sys, browser, runtime
from urllib import urlopen
from optparse import OptionParser

if __name__ == '__main__':
    parser = OptionParser(usage='%prog [file...]')
    options, arguments = parser.parse_args()

    inputFile = arguments[0]
    script = arguments[1]
    outputFile = arguments[2]

    runtime.initialize()
    runtime.load(inputFile)
    browser = runtime._browser
    
    with open(script, 'r') as f:
        script_text = f.read()

    with open(outputFile, 'w') as out:
        browser.execScript(script_text)
        globEnv = browser.interpreter.globEnv
        if "output" in globEnv:
            out.write(str(globEnv["output"]) + "\n")
        else:
            out.write("No output in global environment\n")
        
