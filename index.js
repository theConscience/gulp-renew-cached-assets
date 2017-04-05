'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var fs = require('fs');
var path = require('path');
var shell = require('shelljs');

module.exports = function(option) {
  'use strict';

  var logger = {
    DETAILED: false,
    IMPORTANT: false
  };

  var CSS_LINK_PATTERN = '<link\\s*(.*?)\\s*>'; //'<link href='([^\\.]\\.css)'[^>]*>';
  var JS_SCRIPT_PATTERN = '<script\\s*(.*?)\\s*></script>';

  var ASSET_ATTR_SUFFIX_PATTERN = '([^\'\\"]*)';
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

  if (option.static_assets_dir) {
    try {
      option.static_assets_dir = option.static_assets_dir.toString();
    } catch (e) {
      this.emit(
        'error',
        new gutil.PluginError(
          'gulp-renew-cached-assets',
          ' Invalid `static_assets_dir` parameter. String required.'
        )
      );
    }
  } else {
    option.static_assets_dir = '';
  }

  // if (option.django_static_variable) {
  //   try {
  //     option.django_static_variable = '{{ ' +
  //       option.django_static_variable +
  //       ' }}';
  //   } catch (e) {
  //     this.emit(
  //       'error',
  //       new gutil.PluginError(
  //         'gulp-renew-cached-assets',
  //         ' Invalid `django_static_variable` parameter. String required.'
  //       )
  //     );
  //   }
  // } else {
  //   option.django_static_variable = '{{ STATIC_URL }}';
  // }

  // if (option.django_ext_variable) {
  //   try {
  //     option.django_ext_variable = '{{ ' + option.django_ext_variable + ' }}';
  //   } catch (e) {
  //     this.emit(
  //       'error',
  //       new gutil.PluginError(
  //         'gulp-renew-cached-assets',
  //         ' Invalid `django_ext_variable` parameter. String required.'
  //       )
  //     );
  //   }
  // } else {
  //   option.django_ext_variable = '{{ STATIC_EXT }}';
  // }

  if (option.prepend_static_path) {
    option.prepend_static_path = option.prepend_static_path.toString();
  } else {
    option.prepend_static_path = '/';
  }

  if (option.html_templates_dir) {
    option.html_templates_dir = '' + option.html_templates_dir;
  } else {
    option.html_templates_dir = '';
  }

  var ignoredTemplatesDirs = '';
  if (option.ignored_templates_dirs) {
    var ignoredTemplatesDirsArr = option.ignored_templates_dirs.map(function(dir) {
      return dir.replace(new RegExp(option.static_assets_dir, 'gi'), '');
    });
    ignoredTemplatesDirs = ignoredTemplatesDirsArr.join(',');
  }

  if (option.clear_assets_get_params) {
    option.clear_assets_get_params = option.clear_assets_get_params;
  }

  if (option.use_git_add) {
    option.use_git_add = option.use_git_add;
  }

  if (option.log === 'detailed') {
    logger.DETAILED = true;
    logger.IMPORTANT = true;
  }

  if (option.log === 'important') {
    logger.IMPORTANT = true;
  }

  if (logger.IMPORTANT) {
    console.log('option.path = ' + option.path);
    console.log('option.css_match_pattern = ' + option.css_match_pattern);
    console.log('option.js_match_pattern = ' + option.js_match_pattern);
    console.log('option.static_url_path = ' + option.static_url_path);
    // console.log('option.django_static_variable = ' + option.django_static_variable);
    // console.log('option.django_ext_variable = ' + option.django_ext_variable);
    console.log('option.prepend_static_path = ' + option.prepend_static_path);
    console.log('option.static_assets_dir = ' + option.static_assets_dir);
    console.log('option.html_templates_dir = ' + option.html_templates_dir);
    console.log('option.ignored_templates_dirs = ' + option.ignored_templates_dirs);
    console.log('ignoredTemplatesDirs = ' + ignoredTemplatesDirs);
    console.log('option.clear_assets_get_params = ' + option.clear_assets_get_params);
    console.log('option.use_git_add = ' + option.use_git_add);
    console.log('option.version_stamp = ' + option.version_stamp);
  }

  function throwError(msg) {
    self.emit('error', new gutil.PluginError('gulp-renew-cached-assets', msg));
  }

  function renewCachedAsset(file, enc, callback) {
    if (logger.DETAILED) {
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
          'gulp-renew-cached-assets',
          'Stream content is not supported'
        )
      );
      return callback();
    }

    // check if file.contents is a `Buffer`
    if (file.isBuffer()) {
      new gutil.log('file is buffer!');

      if (logger.DETAILED) {
        new gutil.log(gutil.colors.yellow('Files path is: ') + '\n' + gutil.colors.magenta(file.path));
      }

      // var fileRelativePathNormalized = file.relative.replace(/\\/g, '/');
      // if (logger.DETAILED) { console.log('Normalized file.relative:', fileRelativePathNormalized); }

      var relativePath = path.relative(option.static_assets_dir, path.relative(file.cwd, file.path));
      if (logger.DETAILED) { console.log('relativePath:', relativePath); }

      var relativePathNormalized = relativePath.replace(/\\/g, '/');
      if (logger.IMPORTANT) { console.log('relativePathNormalized:', relativePathNormalized); }

      var htmlTemplatesDir = option.html_templates_dir.replace(/^(\.\\|\\|\.\/|\/)/g, '');
      if (logger.IMPORTANT) { console.log('htmlTemplatesDir:', htmlTemplatesDir); }

      var assetPattern = option.prepend_static_path + relativePathNormalized;
      if (logger.IMPORTANT) { console.log('assetPattern:', assetPattern); }

      /**
       * Находим все файлы .html в templates/ рекурсивно, в которых есть вхождение строки {{ static_url }} (регистронезависимое)
       * и выводим файлы и строки вхождений, исключая папку __build/
       * grep -ir '{{ static_url }}' templates/ --include='*.html' --exclude-dir='__build/'
       * если нужно исключить несколько папок: --exclude-dir={__build/,external/}
       *
       * находим тоже самое, только ограничиваемся при выводе именами файлов,
       * затем меняем для каждого из найденных файлов строку {{ static_url }} (регистронезависимо)  на строку {{ STATIC_URL }}
       * grep -irl '{{ static_url }}' templates/ --include='*.html' | xargs sed -i 's/{{ static_url }}/{{ STATIC_URL }}/gi'
       */

      var shellCommand = "grep -irl '" + assetPattern +  "' " + htmlTemplatesDir + " --include=\\*.html --exclude-dir={" + ignoredTemplatesDirs + "}";
      if (logger.IMPORTANT) { console.log('shellCommand:', shellCommand); }

      var dependentHTMLs = shell.exec(shellCommand).stdout;
      if (!dependentHTMLs) {
        if (logger.IMPORTANT) { new gutil.log('shell.exec2: This asset: ' + file.relative + ' has no dependent HTML files!\n\n'); }
      } else {
        var dependentHTMLsArr = dependentHTMLs.split('\n').filter(function(htmlFileName) { return htmlFileName });

        if (logger.IMPORTANT) { new gutil.log('shell.exec2: $$$ succeeded! $$$'); }
        if (logger.DETAILED) { new gutil.log('shell.exec2: Asset ' + file.relative + ' has dependent HTMLs!\n' + dependentHTMLs); }
        if (logger.IMPORTANT) { new gutil.log('dependentHTMLsArr:', dependentHTMLsArr); }

        var initialVersionNumber = 1;
        var taskStartTimeStamp = new Date().getTime();
        var taskStartDate = new Date(taskStartTimeStamp).toLocaleDateString();
        var taskStartTime = new Date(taskStartTimeStamp).toLocaleTimeString();
        taskStartTime = taskStartTime.replace(/:/gi, '-');

        if (logger.IMPORTANT) { console.log('Task started at:', taskStartTimeStamp); }

        dependentHTMLsArr.forEach(function(htmlFileName) {
          var htmlFileContent = String(fs.readFileSync(htmlFileName));

          if (logger.DETAILED) {
            console.log('\n');
            console.log(htmlFileContent);
          }

          if (option.clear_assets_get_params) {
            if (logger.IMPORTANT) { console.log('Gonna clear version GET parameters...'); }
            var clearedHtmlFileContent = htmlFileContent.replace(new RegExp(assetPattern + ASSET_ATTR_SUFFIX_PATTERN, 'gi'), assetPattern);
            if (logger.DETAILED) {
              console.log('clearedHtmlFileContent:\n');
              console.log(clearedHtmlFileContent);
            }
            fs.writeFileSync(htmlFileName, clearedHtmlFileContent);

            if (option.use_git_add) {
              var gitAddCommand = 'git add ' + htmlFileName;
              if (logger.IMPORTANT) { console.log('gitAddCommand:', gitAddCommand); }
              shell.exec(gitAddCommand);
            }

            return;
          }
          var newVersionGETParam = '';
          if (option.version_stamp === 'date') {
            newVersionGETParam = createDateGETParam(taskStartDate);
          } else if (option.version_stamp === 'date.time') {
            newVersionGETParam = createDateTimeGETParam(taskStartDate + '.' + taskStartTime);
          } else {
            newVersionGETParam = createVersionGETParam(taskStartTimeStamp, initialVersionNumber);
          }

          var versionMatchesArr = htmlFileContent.match(assetPattern + VERSION_OF_ASSET_PATTERN, 'gi');
          if (logger.DETAILED) { console.log('versionMatchesArr:', versionMatchesArr); }
          if (versionMatchesArr) {
            var versionGETParam = versionMatchesArr[1];
            if (logger.IMPORTANT) { console.log('versionGETParam:', versionGETParam); }
            if (versionGETParam) {
              if (option.version_stamp === 'date') {
                if (logger.IMPORTANT) { console.log('Setting date as version stamp!'); }
                var todaysVersionDate = getVersionDate(versionGETParam);
                if (logger.IMPORTANT) { console.log('todaysVersionDate:', todaysVersionDate); }
                if (todaysVersionDate === taskStartDate) {
                  newVersionGETParam = '?v=' + versionGETParam;
                  // return;
                } else {
                  if (logger.IMPORTANT) { console.log('No version date GET parameter!, Use initial:', newVersionGETParam); }
                }
              } else if (option.version_stamp === 'date.time') {
                if (logger.IMPORTANT) { console.log('Setting date.time as version stamp!'); }
                if (versionGETParam === taskStartDate + '.' + taskStartTime) {
                  console.log('\n!!!!!\nSTRANGE BEHVIOUR!!! \n!!!!!\n');
                  newVersionGETParam = '?v=' + versionGETParam;
                  // return;
                } else {
                  if (logger.IMPORTANT) { console.log('No version date.time GET parameter!, Use initial:', newVersionGETParam); }
                }
              } else if (option.version_stamp === 'number.timestamp') {
                if (logger.IMPORTANT) { console.log('Setting number.timestamp as version stamp!'); }
                var oldVersionNumber = getVersionNumber(versionGETParam);
                if (logger.IMPORTANT) { console.log('oldVersionNumber:', oldVersionNumber); }
                var newVersionNumber = oldVersionNumber + 1;
                if (logger.IMPORTANT) { console.log('newVersionNumber:', newVersionNumber); }
                newVersionGETParam = createVersionGETParam(taskStartTimeStamp, newVersionNumber);
                if (logger.IMPORTANT) { console.log('newVersionGETParam:', newVersionGETParam); }
              }
            } else {
              if (logger.IMPORTANT) { console.log('No version GET parameter!, Use initial:', newVersionGETParam); }
            }
          } else {
            if (logger.IMPORTANT) {
              console.log('No match for version GET param regexp...');
              console.log('Use initial:', newVersionGETParam);
            }
          }
          if (logger.IMPORTANT) { console.log('Get asset suffix'); }
          var assetAttrSuffixMatchesArr = htmlFileContent.match(assetPattern + ASSET_ATTR_SUFFIX_PATTERN, 'gi');
          if (logger.DETAILED) { console.log('assetAttrSuffixMatchesArr:', assetAttrSuffixMatchesArr); }
          if (assetAttrSuffixMatchesArr) {
            var assetAttrSuffix = assetAttrSuffixMatchesArr[1];
            if (logger.IMPORTANT) {
              console.log('assetAttrSuffix:', assetAttrSuffix);
              console.log('replace it with this value:', newVersionGETParam);
            }
            var newHtmlFileContent = htmlFileContent.replace(new RegExp(assetPattern + ASSET_ATTR_SUFFIX_PATTERN, 'gi'), assetPattern + newVersionGETParam);
            if (logger.DETAILED) { console.log('===============\n', newHtmlFileContent); }
            if (logger.IMPORTANT) { console.log('Replacing HTML file contents...\n'); }
            fs.writeFileSync(htmlFileName, newHtmlFileContent);

            if (option.use_git_add) {
              var gitAddCommand = 'git add ' + htmlFileName;
              if (logger.IMPORTANT) { console.log('gitAddCommand:', gitAddCommand); }
              shell.exec(gitAddCommand);
            }

          } else {
            if (logger.IMPORTANT) { console.log('ERROR: no assetAttrSuffixMatchesArr!!!'); }
            this.emit('error', new gutil.PluginError(
              'gulp-renew-cached-assets',
              ' ERROR: ' + assetPattern + ' + ASSET_ATTR_SUFFIX_PATTERN regexp match couldn grep any entries from HTML !!!'
            ));
          }

          function getVersionDate(getParam) {
            if (logger.DETAILED) {
              var getParamContents = getParam.split('.');
              console.log('getParamContents:', getParamContents);
              var versionDateStr = getParamContents[0];
              console.log('versionDateStr', versionDateStr);
            }
            var result = getParam.split('.')[0];
            return result;
          }

          function createDateGETParam(versionDate) {
            if (versionDate) {
              return '?v=' + versionDate;
            } else {
              return '?v=' + new Date().toLocaleDateString();
            }
          }

          function getVersionTime(getParam) {
            if (logger.DETAILED) {
              var getParamContents = getParam.split('.');
              console.log('getParamContents:', getParamContents);
              var versionTimeStr = getParamContents[1];
              console.log('versionTimeStr', versionTimeStr);
            }
            var result = getParam.split('.')[1];
            return result;
          }

          function createDateTimeGETParam(versionDateTime) {
            if (versionDateTime) {
              return '?v=' + versionDateTime;
            } else {
              var nowDate = new Date().toLocaleDateString();
              var nowTime = new Date().toLocaleTimeString();
              nowTime = nowTime.replace(/:/gi, '-');
              return '?v=' + nowDate + '.' + nowTime;
            }
          }

          function getVersionNumber(getParam) {
            if (logger.DETAILED) {
              var getParamContents = getParam.split('.');
              console.log('getParamContents:', getParamContents);
              var versionStr = getParamContents[0];
              console.log('versionStr', versionStr);
            }
            var result = Number(getParam.split('.')[0], 10);
            return isNaN(result) ? 0 : result;
          }

          function createVersionGETParam(timeStamp, versionNumber) {
            if (versionNumber && timeStamp) {
              return '?v=' + versionNumber + '.' + timeStamp;
            } else if (versionNumber) {
              return '?v=' + versionNumber + '.' + new Date().getTime();
            } else if (timeStamp) {
              return '?v=1.' + timeStamp;
            } else {
              return '?v=1.' + new Date().getTime();
            }
          }

        });

        if (logger.IMPORTANT) { console.log('\n'); }

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
