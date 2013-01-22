#!/usr/bin/env python

import cgi
import cgitb
import subprocess
import tempfile
import os
import sys, os, traceback, httplib, types
from cStringIO import StringIO
from gzip import GzipFile
import sqlite3

data_root = "/Users/jantemmerman/Sites/data/wotreplay-viewer/"

# connect to database
db = os.path.join(data_root, 'db.sqlite')
conn = sqlite3.connect(db)
c = conn.cursor()

# setup database
c.execute('create table if not exists replay_file (path varchar)')

# enable cgi debugging
cgitb.enable()

form = cgi.FieldStorage()

if form.has_key('id'):
	c.execute('select path from replay_file where rowid = %s' % int(form['id'].value))
	path = c.fetchone()[0]
else:
	replays_dir = os.path.join(data_root, "replays")
	fd, path = tempfile.mkstemp('.wotreplay', 'tmp', replays_dir);
	replay = os.fdopen(fd, 'wb')
	replay.write(form['file'].value)
	# register entry
	c.execute("insert into replay_file (path) values ('%s')" % path)
	conn.commit()
	conn.close()
	# fd and replay have same fd
	replay.close()

data = subprocess.check_output(["./wotreplay-parser", "-t", "json", "-i", path])

if os.environ.get('HTTP_ACCEPT_ENCODING', '').find('gzip') != -1:
	buff = StringIO()
	gz = GzipFile(fileobj=buff, mode='wb', compresslevel=9)
	gz.write(data)
	gz.close()
	data = buff.getvalue()

# create response object
response  = "Content-Type: application/json\n"	
response += 'Content-Encoding: gzip\n'
response += 'Content-Lenght: %s\n' % len(data)
response += "\n" + data

print response

