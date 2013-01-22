#!/usr/bin/env python

import cgi
import cgitb
import json
import os
import sqlite3
import subprocess
import tempfile

from cStringIO import StringIO
from gzip import GzipFile

data_root = "/Users/jantemmerman/Sites/data/wotreplay-viewer/"
viewer_location = "/~jantemmerman/wotreplay-viewer/#%s"

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
	replay_id = int(form['id'].value)
	c.execute('select path from replay_file where rowid = %s' % replay_id)
	path = c.fetchone()[0]
else:
	replays_dir = os.path.join(data_root, "replays")
	fd, path = tempfile.mkstemp('.wotreplay', 'tmp', replays_dir);
	replay = os.fdopen(fd, 'wb')
	replay.write(form['file'].value)
	# register entry
	c.execute("insert into replay_file (path) values ('%s')" % path)
	replay_id = c.lastrowid
	conn.commit()
	conn.close()
	# fd and replay have same fd
	replay.close()

data = {
	'id': replay_id,
	'permalink': os.environ['HTTP_HOST'] + (viewer_location % replay_id),
	'data': json.loads(subprocess.check_output(["./wotreplay-parser", "-t", "json", "-i", path]))
}

data = json.dumps(data)

# create response object
response  = "Content-Type: application/json\n"	

# compress data if gzip enabled
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

