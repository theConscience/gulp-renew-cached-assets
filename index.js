'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var fs = require('fs');
var path = require('path');
var shell = require('shelljs');

module.exports = function(option) {
  'use strict';
  var logger = true;

  var CONST_PATTERN = '<\\!--\\s*inject-style\\s*(.*?)\\s*-->';
  var CSS_LINK_PATTERN = '<link\\s*(.*?)\\s*>'; //'<link href='([^\\.]\\.css)'[^>]*>';
  var JS_SCRIPT_PATTERN = '<script\\s*(.*?)\\s*></script>';

  var VERSION_OF_ASSET_PATTERN = '\\?v=(.*?)(?=[\'"])';

  var JS_SCRIPT_PATTERN_2 = '<script(\\s*(\\S*)(?==)="([^"]*)(?=")")+\\s*></script>';
  var JS_SCRIPT_SRC_PATTERN = '<script(.*\\s(src)(?==)="([^"]*)(?=")".*)\\s*></script>';
  var JS_SCRIPT_TYPE_PATTERN = '<script(.*\\s(type)(?==)="([^"]*)(?=")".*)\\s*></script>';

  var CSS_STYLE_HREF_PATTERN = '<link(.*\\s(href)(?==)="([^"]*)(?=")".*)\\s*/?>';
  var CSS_STYLE_REL_PATTERN = '<link(.*\\s(rel)(?==)="([^"]*)(?=")".*)\\s*/?>';

  var IMG_SRC_PATTERN = '<img(.*\\s(src)(?==)="([^"]*)(?=")".*)\\s*/?>';

  var self = null;

  if (!option) {
    option = {};
  }

  if (!option.path) {
    option.path = '';
  }

  if (option.match_pattern) {
    try {
      new RegExp(option.match_pattern);
    } catch (e) {
      this.emit(
        'error',
        new gutil.PluginError(
          'gulp-renew-cached-assets',
          ' Invalid `match_pattern` parameter. Regular expression string required.'
        )
      );
    }
  } else {
    option.match_pattern = CONST_PATTERN;
  }

  if (option.css_match_pattern) {
    try {
      new RegExp(option.css_match_pattern);
    } catch (e) {
      this.emit(
        'error',
        new gutil.PluginError(
          'gulp-renew-cached-assets',
          ' Invalid `css_match_pattern` parameter. Regular expression string required.'
        )
      );
    }
  } else {
    option.css_match_pattern = CSS_LINK_PATTERN;
  }

  if (option.js_match_pattern) {
    try {
      new RegExp(option.js_match_pattern);
    } catch (e) {
      this.emit(
        'error',
        new gutil.PluginError(
          'gulp-renew-cached-assets',
          ' Invalid `js_match_pattern` parameter. Regular expression string required.'
        )
      );
    }
  } else {
    option.js_match_pattern = JS_SCRIPT_PATTERN;
  }

  if (option.static_url_path) {
    try {
      option.static_url_path = '' + option.static_url_path;
    } catch (e) {
      this.emit(
        'error',
        new gutil.PluginError(
          'gulp-renew-cached-assets',
          ' Invalid `static_url_path` parameter. String required.'
        )
      );
    }
  } else {
    option.static_url_path = '';
  }

  if (option.django_static_variable) {
    try {
      option.django_static_variable = '{{ ' +
        option.django_static_variable +
        ' }}';
    } catch (e) {
      this.emit(
        'error',
        new gutil.PluginError(
          'gulp-renew-cached-assets',
          ' Invalid `django_static_variable` parameter. String required.'
        )
      );
    }
  } else {
    option.django_static_variable = '{{ STATIC_URL }}';
  }

  if (option.django_ext_variable) {
    try {
      option.django_ext_variable = '{{ ' + option.django_ext_variable + ' }}';
    } catch (e) {
      this.emit(
        'error',
        new gutil.PluginError(
          'gulp-renew-cached-assets',
          ' Invalid `django_ext_variable` parameter. String required.'
        )
      );
    }
  } else {
    option.django_ext_variable = '{{ STATIC_EXT }}';
  }

  console.log('option.path = ' + option.path);
  console.log('option.css_match_pattern = ' + option.css_match_pattern);
  console.log('option.js_match_pattern = ' + option.js_match_pattern);
  console.log('option.static_url_path = ' + option.static_url_path);
  console.log(
    'option.django_static_variable = ' + option.django_static_variable
  );
  console.log('option.django_ext_variable = ' + option.django_ext_variable);

  function throwError(msg) {
    self.emit('error', new gutil.PluginError('gulp-renew-cached-assets', msg));
  }

  function getAttributes(params) {
    new gutil.log('getAttributes get such parameters:' + params);

    if (params.indexOf(option.django_static_variable) !== -1) {
      params = params.replace(
        option.django_static_variable,
        option.static_url_path
      );
      new gutil.log('django_static_variable replaced, params is: ' + params);
    }
    if (params.indexOf(option.django_ext_variable) !== -1) {
      params = params.replace(option.django_ext_variable, '');
      new gutil.log('django_ext_variable deleted, params is: ' + params);
    }

    var result = {};

    params = params.replace(
      new RegExp(VERSION_OF_ASSET_PATTERN, 'gi'),
      function(str, version) {
        // вырезаем версию, если есть
        result['version'] = version;
        if (logger) {
          console.log(
            'version ' +
              version +
              ' found, remove from attribute, adding to params'
          );
        }
        return '';
      }
    );

    var group = params.replace(/\s+/gi, ' ').split(' ');
    for (var i = 0; i < group.length; i++) {
      if (group[i]) {
        var combination = group[i].split('=');
        result[
          combination[0].replace(/\s*['"](.*)['"]\s*/, '$1')
        ] = combination[1].replace(/\s*['"](.*)['"]\s*/, '$1');
      }
    }
    return result;
  }

  function getSingleStyleFile(source) {
    if (source) {
      var file = fs.readFileSync(source);
      if (logger) {
        console.log('CSS Style FILE: \n', file);
      }
      return transformLinkBundleResponse(file);
    } else {
      throwError('ERROR: No source file specified.');
    }
  }

  function getSingleScriptFile(source) {
    if (source) {
      var file = fs.readFileSync(source);
      if (logger) {
        console.log('JS Script FILE: \n', file);
      }
      return transformScriptBundleResponse(file);
    } else {
      throwError('ERROR: No source file specified.');
    }
  }

  function renewCachedAsset(file, enc, callback) {
    if (logger) {
      console.log('===');
      console.log('file:', file);
      console.log('file.contents', file.contents);
      console.log('file.relative:', file.relative);
      console.log('file.base:', file.base);
      console.log('file.cwd:', file.cwd);
      console.log('file.path:', file.path);
      console.log('file.history:', file.history);
      console.log('===');
    }

    self = this;

    // Do nothing if no contents
    if (file.isNull()) {
      this.push(file);
      return callback();
    }

    // check if file.contents is a `Stream`
    if (file.isStream()) {
      // accepting streams is optional
      this.emit(
        'error',
        new gutil.PluginError(
          'gulp-file-inject',
          'Stream content is not supported'
        )
      );
      return callback();
    }

    // check if file.contents is a `Buffer`
    if (file.isBuffer()) {
      new gutil.log('file is buffer!');

      if (logger) {
        new gutil.log(
          gutil.colors.yellow('Files path is: ') +
            '\n' +
            gutil.colors.magenta(file.path)
        );
      } 

      var dependentHTMLs = shell.grep('-l', '{{ static_url }}external/js/', 'templates/*/*.html');

      // if (!dependentHTMLs) {
      //   new gutil.log(('This asset: ' + file.base + ' has no dependent HTML files!')
      // } else {
      //   new gutil.log(('$$$ GREP SUCCESS $$$');
      //   new gutil.log(('Asset ' + file.base + ' has dependent HTMLs!\n' + dependentHTMLs);
      // }

      if (shell.exec("grep -il '{{ static_url }}external/js/' 'templates/*/*.html'").code !== 0) {
        new gutil.log(('This asset: ' + file.base + ' has no dependent HTML files!');
      } else {
        new gutil.log(('$$$ GREP SUCCESS $$$');
      }

      this.push(file);

      return callback();
    } else {
      console.log('file is not buffer!');
    }

    return callback();
  }

  return through.obj(renewCachedAsset);
};
