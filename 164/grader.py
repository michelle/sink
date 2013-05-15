#!/usr/bin/env python

import os, sys, subprocess, difflib, time, signal

class Timeout(RuntimeError):
    def __str__(self):
        return "Timeout"
        
def runProc(process, timeout):
    start = time.time()
    while process.poll() is None:
        time.sleep(1.0)
        if float(time.time() - start) > float(timeout):
            os.kill(process.pid, signal.SIGKILL)
            os.waitpid(-1, os.WNOHANG)
            raise Timeout
    return process.communicate()

def compare(ref, test):
    ref_lines = [l.strip() for l in open(ref, 'U').readlines() if l.strip()]
    test_lines = [l.strip() for l in open(test, 'U').readlines() if l.strip()]
    diffOutput = difflib.unified_diff(ref_lines, 
                                      test_lines, 
                                      fromfile="Solutions", 
                                      tofile="Test")
    tx = ''
    for line in diffOutput:
        tx = tx + line
        
    if tx: return 0
    else: return 1

def runTest(page, test, ref_output, test_output):
    try:
        p = subprocess.Popen('python %s %s %s %s' % (program, page, test, test_output), shell=True)
        runProc(p, timeout)
        return compare(ref_output, test_output)
    except Timeout:
        print ("Timeout")
        return 0
    except:
        print ("Interpreter Error")
        return 0

program = "browser_test.py"
testDir = "tests" + os.sep
timeout = 10

categories = ['rx-grader']
categories.sort()
tests = {}
scores = {}
max_scores = {}
for cat in categories:
    tests[cat] = filter(lambda f: f.endswith(".164"), os.listdir(testDir + cat))
    scores[cat] = 0
    max_scores[cat] = 0


for (cat, tl) in tests.items():
    for test in tl:
        testPath = testDir + cat + os.sep + test
        page = testDir + cat + os.sep + 'page.tml'
        ref_output = testPath + '.out'
        test_output = testPath + '.tmp'
        res = runTest(page, testPath, ref_output, test_output)
        if (res == 0):
            print (cat + os.sep + test + '  Failed')
        scores[cat] = scores[cat] + res
        max_scores[cat] = max_scores[cat] + 1
      
total = 0
max_total = 0  
print ("\nScores:")
for cat in categories:
    print ("\t" + cat + ": " + str(scores[cat]) + " passed out of " + str(max_scores[cat]))
    total = total + scores[cat]
    max_total = max_total + max_scores[cat]

print ("Total: " + str(total) + " \ " + str(max_total))

