
var request = require('../../')
  , express = require('express')
  , assert = require('assert')
  , app = express.createServer()
  , fs = require('fs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

app.post('/echo', function(req, res){
  res.writeHead(200, req.headers);
  req.pipe(res);
});

app.listen(3005);

function boundary(ct) {
  return ct.match(/boundary="(.*)"/)[1];
}

describe('Request', function(){
  describe('#part()', function(){
    it('should return a new Part', function(){
      var req = request.post('http://localhost:3005');
      req.part().constructor.name.should.equal('Part');
      req.part().constructor.name.should.equal('Part');
      req.part().should.not.equal(req.part());
    })
  })

  it('should default res.files to {}', function(done){
    var req = request.post('http://localhost:3005/echo');

    req.end(function(res){
      res.files.should.eql({});
      res.body.should.eql({});
      done();
    });
  })

  describe('#field(name, value)', function(){
    it('should set a multipart field value', function(done){
      var req = request.post('http://localhost:3005/echo');

      req.field('user[name]', 'tobi');
      req.field('user[age]', '2');
      req.field('user[species]', 'ferret');

      req.end(function(res){
        res.body['user[name]'].should.equal('tobi');
        res.body['user[age]'].should.equal('2');
        res.body['user[species]'].should.equal('ferret');
        done();
      });
    })

    it('should work with file attachments', function(done){
      var req = request.post('http://localhost:3005/echo');

      req.field('name', 'Tobi');
      req.attach('test/node/fixtures/user.html', 'document');
      req.field('species', 'ferret');

      req.end(function(res){
        res.body.name.should.equal('Tobi');
        res.body.species.should.equal('ferret');

        var html = res.files.document;
        html.name.should.equal('document');
        html.type.should.equal('text/html');
        read(html.path).should.equal('<h1>name</h1>');
        done();
      })
    })
  })

  describe('#attach(file)', function(){
    it('should attach a file', function(done){
      var req = request.post('http://localhost:3005/echo');

      req.attach('test/node/fixtures/user.html');
      req.attach('test/node/fixtures/user.json');
      req.attach('test/node/fixtures/user.txt');

      req.end(function(res){
        var html = res.files['user.html'];
        var json = res.files['user.json'];
        var text = res.files['user.txt'];

        html.name.should.equal('user.html');
        html.type.should.equal('text/html');
        read(html.path).should.equal('<h1>name</h1>');

        json.name.should.equal('user.json');
        json.type.should.equal('application/json');
        read(json.path).should.equal('{"name":"tobi"}');

        text.name.should.equal('user.txt');
        text.type.should.equal('text/plain');
        read(text.path).should.equal('Tobi');

        done();
      })
    })

    describe('when a file does not exist', function(){
      it('should emit an error', function(done){
        var req = request.post('http://localhost:3005/echo');

        req.attach('foo');
        req.attach('bar');
        req.attach('baz');

        req.on('error', function(err){
          err.message.should.include('ENOENT, no such file');
          err.path.should.equal('foo');
          done();
        });

        req.end(function(res){
          assert(0, 'end() was called');
        });
      })
    })
  })

  describe('#attach(file, filename)', function(){
    it('should use the custom filename', function(done){
      request
      .post(':3005/echo')
      .attach('test/node/fixtures/user.html', 'document')
      .end(function(res){
        var html = res.files.document;
        html.name.should.equal('document');
        html.type.should.equal('text/html');
        read(html.path).should.equal('<h1>name</h1>');
        done();
      })
    })
  })
})

describe('Part', function(){
  describe('with a single part', function(){
    it('should construct a multipart request', function(done){
      var req = request.post('http://localhost:3005/echo');
  
      req
        .part()
        .set('Content-Disposition', 'attachment; name="image"; filename="image.png"')
        .set('Content-Type', 'image/png')
        .write('some image data');
  
      req.end(function(res){
        var ct = res.header['content-type'];
        ct.should.include('multipart/form-data; boundary=');
        res.body.should.eql({});
        res.files.image.name.should.equal('image.png');
        res.files.image.type.should.equal('image/png');
        done();
      });
    })
  })

  describe('with several parts', function(){
    it('should construct a multipart request', function(done){
  
      var req = request.post('http://localhost:3005/echo');
  
      req.part()
        .set('Content-Type', 'image/png')
        .set('Content-Disposition', 'attachment; filename="myimage.png"')
        .write('some image data');
  
      var part = req.part()
        .set('Content-Type', 'image/png')
        .set('Content-Disposition', 'attachment; filename="another.png"')
  
      part.write('random');
      part.write('thing');
      part.write('here');
  
      req.part()
        .set('Content-Disposition', 'form-data; name="name"')
        .set('Content-Type', 'text/plain')
        .write('tobi');
  
      req.end(function(res){
        res.body.name.should.equal('tobi');
        Object.keys(res.files).should.eql(['myimage.png', 'another.png']);
        done();
      });
    })
  })

  describe('with a Content-Type specified', function(){
    it('should append the boundary', function(done){
      var req = request
        .post('http://localhost:3005/echo')
        .type('multipart/form-data');
  
      req
        .part()
        .set('Content-Type', 'text/plain')
        .set('Content-Disposition', 'form-data; name="name"')
        .write('Tobi');
  
      req.end(function(res){
        res.header['content-type'].should.include('boundary=');
        res.body.name.should.equal('Tobi');
        done();
      });
    })
  })

  describe('#name(str)', function(){
    it('should set Content-Disposition to form-data and name param', function(done){
      var req = request
        .post('http://localhost:3005/echo');
  
      req
        .part()
        .name('user[name]')
        .write('Tobi');
  
      req.end(function(res){
        res.body['user[name]'].should.equal('Tobi');
        done();
      });
    })
  })

  describe('#filename(str)', function(){
    it('should set Content-Disposition and Content-Type', function(done){
      var req = request
        .post('http://localhost:3005/echo')
        .type('multipart/form-data');
  
      req
        .part()
        .filename('path/to/my.txt')
        .write('Tobi');
  
      req.end(function(res){
        var file = res.files['my.txt'];
        file.name.should.equal('my.txt');
        file.type.should.equal('text/plain');
        done();
      });
    })
  })
})
