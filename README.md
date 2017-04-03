# gulp-renew-cached-assets
Repo for gulp plugin, which adds versioning GET-parameters to entry static asset dependant HTML files
( &lt;script src="path/to/file/file_name.js?v=0.0.1"> ).
If they are already exists - increase version count.
Supposed to be used on pre-commit hook.
Take static assets files as entries, look for dependant HTML in given folder, change script, link or image tags src/href attribute values.
