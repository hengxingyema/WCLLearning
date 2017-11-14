/**
 * Created by apple on 7/29/16.
 */
module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        uglify: {
            options: {
                mangle: false
            },
            my_target: {
                files: [{
                    expand: true,
                    cwd: 'public/javascripts/',
                    src: ['*.js', '!*.min.js'],
                    dest: 'public/javascripts/',
                    ext: '.min.js'
                }]
            }
        },

        cssmin: {
            my_target: {
                files: [{
                    expand: true,
                    cwd: 'public/stylesheets/',
                    src: ['*.css', '!*.min.css'],
                    dest: 'public/stylesheets/',
                    ext: '.min.css'
                }]
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
};