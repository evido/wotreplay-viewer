#!/usr/bin/env python

import cgi
import cgitb
import subprocess
import tempfile
import os
import sys, os, traceback, httplib, types
from cStringIO import StringIO
from gzip import GzipFile

cgitb.enable()

response = "Content-Type: application/json\n"

form = cgi.FieldStorage()
fd, path = tempfile.mkstemp('.wotreplay', 'tmp', "/Users/jantemmerman/Sites/data/");
replay = os.fdopen(fd, 'wb')
replay.write(form['file'].value)
# fd and replay have same fd
replay.close()

data = subprocess.check_output(["./wotreplay-parser", "-t", "json", "-i", path])

if os.environ.get('HTTP_ACCEPT_ENCODING', '').find('gzip') != -1:
	buff = StringIO()
	gz = GzipFile(fileobj=buff, mode='wb', compresslevel=9)
	gz.write(data)
	gz.close()
	data = buff.getvalue()
	
response += 'Content-Encoding: gzip\n'
response += 'Content-Lenght: %s\n' % len(data)
response += "\n" + data

print response

