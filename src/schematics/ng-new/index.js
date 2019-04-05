/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Schematics for ng-new project that builds with Bazel.
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("npm_angular_bazel/src/schematics/ng-new/index", ["require", "exports", "tslib", "@angular-devkit/schematics", "@angular-devkit/core", "@schematics/angular/utility/json-utils", "@angular/bazel/src/schematics/utility/json-utils", "@schematics/angular/utility/validation", "@schematics/angular/utility/config"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var schematics_1 = require("@angular-devkit/schematics");
    var core_1 = require("@angular-devkit/core");
    var json_utils_1 = require("@schematics/angular/utility/json-utils");
    var json_utils_2 = require("@angular/bazel/src/schematics/utility/json-utils");
    var validation_1 = require("@schematics/angular/utility/validation");
    var config_1 = require("@schematics/angular/utility/config");
    /**
     * Packages that build under Bazel require additional dev dependencies. This
     * function adds those dependencies to "devDependencies" section in
     * package.json.
     */
    function addDevDependenciesToPackageJson(options) {
        return function (host) {
            var e_1, _a;
            var packageJson = options.name + "/package.json";
            if (!host.exists(packageJson)) {
                throw new Error("Could not find " + packageJson);
            }
            var packageJsonContent = host.read(packageJson);
            if (!packageJsonContent) {
                throw new Error('Failed to read package.json content');
            }
            var jsonAst = core_1.parseJsonAst(packageJsonContent.toString());
            var deps = json_utils_1.findPropertyInAstObject(jsonAst, 'dependencies');
            var devDeps = json_utils_1.findPropertyInAstObject(jsonAst, 'devDependencies');
            var angularCoreNode = json_utils_1.findPropertyInAstObject(deps, '@angular/core');
            var angularCoreVersion = angularCoreNode.value;
            var devDependencies = {
                '@angular/bazel': angularCoreVersion,
                // TODO(kyliau): Consider moving this to latest-versions.ts
                '@bazel/bazel': '^0.23.0',
                '@bazel/ibazel': '^0.9.0',
                '@bazel/jasmine': '^0.26.0',
                '@bazel/karma': '^0.26.0',
                '@bazel/typescript': '^0.26.0',
            };
            var recorder = host.beginUpdate(packageJson);
            try {
                for (var _b = tslib_1.__values(Object.keys(devDependencies)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var packageName = _c.value;
                    var version = devDependencies[packageName];
                    var indent = 4;
                    json_utils_1.insertPropertyInAstObjectInOrder(recorder, devDeps, packageName, version, indent);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            host.commitUpdate(recorder);
            return host;
        };
    }
    /**
     * Append main.dev.ts and main.prod.ts to src directory. These files are needed
     * by Bazel for devserver and prodserver, respectively. They are different from
     * main.ts generated by CLI because they use platformBrowser (AOT) instead of
     * platformBrowserDynamic (JIT).
     */
    function addDevAndProdMainForAot(options) {
        return function (host) {
            var newProjectRoot = '';
            try {
                var workspace = config_1.getWorkspace(host);
                newProjectRoot = workspace.newProjectRoot || '';
            }
            catch (_a) {
            }
            var srcDir = newProjectRoot + "/" + options.name + "/src";
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings }, options, { 'dot': '.' })),
                schematics_1.move(srcDir),
            ]));
        };
    }
    function overwriteGitignore(options) {
        return function (host) {
            var gitignore = options.name + "/.gitignore";
            if (!host.exists(gitignore)) {
                return host;
            }
            var gitIgnoreContent = host.read(gitignore);
            if (!gitIgnoreContent) {
                throw new Error('Failed to read .gitignore content');
            }
            if (gitIgnoreContent.includes('/bazel-out\n')) {
                return host;
            }
            var lines = gitIgnoreContent.toString().split(/\n/g);
            var recorder = host.beginUpdate(gitignore);
            var compileOutput = lines.findIndex(function (line) { return line === '# compiled output'; });
            recorder.insertRight(compileOutput, '\n/bazel-out');
            host.commitUpdate(recorder);
            return host;
        };
    }
    function updateWorkspaceFileToUseBazelBuilder(options) {
        return function (host, context) {
            var name = options.name;
            var workspacePath = name + "/angular.json";
            if (!host.exists(workspacePath)) {
                throw new schematics_1.SchematicsException("Workspace file " + workspacePath + " not found.");
            }
            var workspaceBuffer = host.read(workspacePath);
            var workspaceJsonAst = core_1.parseJsonAst(workspaceBuffer.toString());
            var projects = json_utils_1.findPropertyInAstObject(workspaceJsonAst, 'projects');
            if (!projects) {
                throw new schematics_1.SchematicsException('Expect projects in angular.json to be an Object');
            }
            var project = json_utils_1.findPropertyInAstObject(projects, name);
            if (!project) {
                throw new schematics_1.SchematicsException("Expected projects to contain " + name);
            }
            var recorder = host.beginUpdate(workspacePath);
            var indent = 6;
            json_utils_2.replacePropertyInAstObject(recorder, project, 'architect', {
                'build': {
                    'builder': '@angular/bazel:build',
                    'options': { 'targetLabel': '//src:bundle.js', 'bazelCommand': 'build' },
                    'configurations': { 'production': { 'targetLabel': '//src:bundle' } }
                },
                'serve': {
                    'builder': '@angular/bazel:build',
                    'options': { 'targetLabel': '//src:devserver', 'bazelCommand': 'run' },
                    'configurations': { 'production': { 'targetLabel': '//src:prodserver' } }
                },
                'extract-i18n': {
                    'builder': '@angular-devkit/build-angular:extract-i18n',
                    'options': { 'browserTarget': name + ":build" }
                },
                'test': {
                    'builder': '@angular/bazel:build',
                    'options': { 'bazelCommand': 'test', 'targetLabel': '//src/...' }
                },
                'lint': {
                    'builder': '@angular-devkit/build-angular:tslint',
                    'options': {
                        'tsConfig': ['src/tsconfig.app.json', 'src/tsconfig.spec.json'],
                        'exclude': ['**/node_modules/**']
                    }
                }
            }, indent);
            var e2e = options.name + "-e2e";
            var e2eNode = json_utils_1.findPropertyInAstObject(projects, e2e);
            if (e2eNode) {
                json_utils_2.replacePropertyInAstObject(recorder, e2eNode, 'architect', {
                    'e2e': {
                        'builder': '@angular/bazel:build',
                        'options': { 'bazelCommand': 'test', 'targetLabel': '//e2e:devserver_test' },
                        'configurations': { 'production': { 'targetLabel': '//e2e:prodserver_test' } }
                    },
                    'lint': {
                        'builder': '@angular-devkit/build-angular:tslint',
                        'options': { 'tsConfig': 'e2e/tsconfig.e2e.json', 'exclude': ['**/node_modules/**'] }
                    }
                }, indent);
            }
            host.commitUpdate(recorder);
            return host;
        };
    }
    /**
     * @angular/bazel requires minimum version of rxjs to be 6.4.0. This function
     * upgrades the version of rxjs in package.json if necessary.
     */
    function upgradeRxjs(options) {
        return function (host, context) {
            var packageJson = options.name + "/package.json";
            if (!host.exists(packageJson)) {
                throw new Error("Could not find " + packageJson);
            }
            var content = host.read(packageJson).toString();
            var jsonAst = core_1.parseJsonAst(content);
            if (!json_utils_2.isJsonAstObject(jsonAst)) {
                throw new Error("Failed to parse JSON for " + packageJson);
            }
            var deps = json_utils_1.findPropertyInAstObject(jsonAst, 'dependencies');
            if (!json_utils_2.isJsonAstObject(deps)) {
                throw new Error("Failed to find dependencies in " + packageJson);
            }
            var rxjs = json_utils_1.findPropertyInAstObject(deps, 'rxjs');
            if (!rxjs) {
                throw new Error("Failed to find rxjs in dependencies of " + packageJson);
            }
            var value = rxjs.value; // value can be version or range
            var match = value.match(/(\d)+\.(\d)+.(\d)+$/);
            if (match) {
                var _a = tslib_1.__read(match, 3), _ = _a[0], major = _a[1], minor = _a[2];
                if (major < '6' || (major === '6' && minor < '4')) {
                    var recorder = host.beginUpdate(packageJson);
                    json_utils_2.replacePropertyInAstObject(recorder, deps, 'rxjs', '~6.4.0');
                    host.commitUpdate(recorder);
                }
            }
            else {
                context.logger.info('Could not determine version of rxjs. \n' +
                    'Please make sure that version is at least 6.4.0.');
            }
            return host;
        };
    }
    /**
     * When using Angular NPM packages and building with AOT compilation, ngc
     * requires ngsumamry files but they are not shipped. This function adds a
     * postinstall step to generate these files.
     */
    function addPostinstallToGenerateNgSummaries(options) {
        return function (host, context) {
            var angularMetadataTsConfig = options.name + "/angular-metadata.tsconfig.json";
            if (!host.exists(angularMetadataTsConfig)) {
                return;
            }
            var packageJson = options.name + "/package.json";
            if (!host.exists(packageJson)) {
                throw new Error("Could not find " + packageJson);
            }
            var content = host.read(packageJson).toString();
            var jsonAst = core_1.parseJsonAst(content);
            var scripts = json_utils_1.findPropertyInAstObject(jsonAst, 'scripts');
            var recorder = host.beginUpdate(packageJson);
            if (scripts) {
                json_utils_1.insertPropertyInAstObjectInOrder(recorder, scripts, 'postinstall', 'ngc -p ./angular-metadata.tsconfig.json', 4);
            }
            else {
                json_utils_1.insertPropertyInAstObjectInOrder(recorder, jsonAst, 'scripts', {
                    postinstall: 'ngc -p ./angular-metadata.tsconfig.json',
                }, 2);
            }
            host.commitUpdate(recorder);
            return host;
        };
    }
    function default_1(options) {
        return function (host) {
            validation_1.validateProjectName(options.name);
            return schematics_1.chain([
                schematics_1.externalSchematic('@schematics/angular', 'ng-new', tslib_1.__assign({}, options)),
                addDevDependenciesToPackageJson(options),
                upgradeRxjs(options),
                addDevAndProdMainForAot(options),
                schematics_1.schematic('bazel-workspace', options, {
                    scope: options.name,
                }),
                overwriteGitignore(options),
                addPostinstallToGenerateNgSummaries(options),
                updateWorkspaceFileToUseBazelBuilder(options),
            ]);
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1uZXcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCx5REFBK007SUFDL00sNkNBQXFGO0lBQ3JGLHFFQUFpSDtJQUNqSCwrRUFBa0Y7SUFDbEYscUVBQTJFO0lBQzNFLDZEQUFnRTtJQUdoRTs7OztPQUlHO0lBQ0gsU0FBUywrQkFBK0IsQ0FBQyxPQUFlO1FBQ3RELE9BQU8sVUFBQyxJQUFVOztZQUNoQixJQUFNLFdBQVcsR0FBTSxPQUFPLENBQUMsSUFBSSxrQkFBZSxDQUFDO1lBRW5ELElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFrQixXQUFhLENBQUMsQ0FBQzthQUNsRDtZQUNELElBQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNsRCxJQUFJLENBQUMsa0JBQWtCLEVBQUU7Z0JBQ3ZCLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQzthQUN4RDtZQUNELElBQU0sT0FBTyxHQUFHLG1CQUFZLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLENBQWtCLENBQUM7WUFDN0UsSUFBTSxJQUFJLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBa0IsQ0FBQztZQUMvRSxJQUFNLE9BQU8sR0FBRyxvQ0FBdUIsQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQWtCLENBQUM7WUFFckYsSUFBTSxlQUFlLEdBQUcsb0NBQXVCLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3ZFLElBQU0sa0JBQWtCLEdBQUcsZUFBaUIsQ0FBQyxLQUFlLENBQUM7WUFF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QUFDO2dCQUNoQyxzQkFBUyxDQUFDLGlCQUFpQixFQUFFLE9BQU8sRUFBRTtvQkFDcEMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxJQUFJO2lCQUNwQixDQUFDO2dCQUNGLGtCQUFrQixDQUFDLE9BQU8sQ0FBQztnQkFDM0IsbUNBQW1DLENBQUMsT0FBTyxDQUFDO2dCQUM1QyxvQ0FBb0MsQ0FBQyxPQUFPLENBQUM7YUFDOUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQXJCRCw0QkFxQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgbmctbmV3IHByb2plY3QgdGhhdCBidWlsZHMgd2l0aCBCYXplbC5cbiAqL1xuXG5pbXBvcnQge1NjaGVtYXRpY0NvbnRleHQsIGFwcGx5LCBhcHBseVRlbXBsYXRlcywgY2hhaW4sIGV4dGVybmFsU2NoZW1hdGljLCBNZXJnZVN0cmF0ZWd5LCBtZXJnZVdpdGgsIG1vdmUsIFJ1bGUsIHNjaGVtYXRpYywgVHJlZSwgdXJsLCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBVcGRhdGVSZWNvcmRlcix9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7cGFyc2VKc29uQXN0LCBKc29uQXN0T2JqZWN0LCBzdHJpbmdzLCBKc29uVmFsdWV9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7ZmluZFByb3BlcnR5SW5Bc3RPYmplY3QsIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge2lzSnNvbkFzdE9iamVjdCwgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3R9IGZyb20gJy4uL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcbmltcG9ydCB7Z2V0V29ya3NwYWNlfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogUGFja2FnZXMgdGhhdCBidWlsZCB1bmRlciBCYXplbCByZXF1aXJlIGFkZGl0aW9uYWwgZGV2IGRlcGVuZGVuY2llcy4gVGhpc1xuICogZnVuY3Rpb24gYWRkcyB0aG9zZSBkZXBlbmRlbmNpZXMgdG8gXCJkZXZEZXBlbmRlbmNpZXNcIiBzZWN0aW9uIGluXG4gKiBwYWNrYWdlLmpzb24uXG4gKi9cbmZ1bmN0aW9uIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gYCR7b3B0aW9ucy5uYW1lfS9wYWNrYWdlLmpzb25gO1xuXG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgcGFja2FnZUpzb25Db250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIXBhY2thZ2VKc29uQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KHBhY2thZ2VKc29uQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXZEZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RldkRlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG5cbiAgICBjb25zdCBhbmd1bGFyQ29yZU5vZGUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXBzLCAnQGFuZ3VsYXIvY29yZScpO1xuICAgIGNvbnN0IGFuZ3VsYXJDb3JlVmVyc2lvbiA9IGFuZ3VsYXJDb3JlTm9kZSAhLnZhbHVlIGFzIHN0cmluZztcblxuICAgIGNvbnN0IGRldkRlcGVuZGVuY2llczoge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge1xuICAgICAgJ0Bhbmd1bGFyL2JhemVsJzogYW5ndWxhckNvcmVWZXJzaW9uLFxuICAgICAgLy8gVE9ETyhreWxpYXUpOiBDb25zaWRlciBtb3ZpbmcgdGhpcyB0byBsYXRlc3QtdmVyc2lvbnMudHNcbiAgICAgICdAYmF6ZWwvYmF6ZWwnOiAnXjAuMjMuMCcsXG4gICAgICAnQGJhemVsL2liYXplbCc6ICdeMC45LjAnLFxuICAgICAgJ0BiYXplbC9qYXNtaW5lJzogJ14wLjI2LjAnLFxuICAgICAgJ0BiYXplbC9rYXJtYSc6ICdeMC4yNi4wJyxcbiAgICAgICdAYmF6ZWwvdHlwZXNjcmlwdCc6ICdeMC4yNi4wJyxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIE9iamVjdC5rZXlzKGRldkRlcGVuZGVuY2llcykpIHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBkZXZEZXBlbmRlbmNpZXNbcGFja2FnZU5hbWVdO1xuICAgICAgY29uc3QgaW5kZW50ID0gNDtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKHJlY29yZGVyLCBkZXZEZXBzLCBwYWNrYWdlTmFtZSwgdmVyc2lvbiwgaW5kZW50KTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCBtYWluLmRldi50cyBhbmQgbWFpbi5wcm9kLnRzIHRvIHNyYyBkaXJlY3RvcnkuIFRoZXNlIGZpbGVzIGFyZSBuZWVkZWRcbiAqIGJ5IEJhemVsIGZvciBkZXZzZXJ2ZXIgYW5kIHByb2RzZXJ2ZXIsIHJlc3BlY3RpdmVseS4gVGhleSBhcmUgZGlmZmVyZW50IGZyb21cbiAqIG1haW4udHMgZ2VuZXJhdGVkIGJ5IENMSSBiZWNhdXNlIHRoZXkgdXNlIHBsYXRmb3JtQnJvd3NlciAoQU9UKSBpbnN0ZWFkIG9mXG4gKiBwbGF0Zm9ybUJyb3dzZXJEeW5hbWljIChKSVQpLlxuICovXG5mdW5jdGlvbiBhZGREZXZBbmRQcm9kTWFpbkZvckFvdChvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgbGV0IG5ld1Byb2plY3RSb290ID0gJyc7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZSA9IGdldFdvcmtzcGFjZShob3N0KTtcbiAgICAgIG5ld1Byb2plY3RSb290ID0gd29ya3NwYWNlLm5ld1Byb2plY3RSb290IHx8ICcnO1xuICAgIH0gY2F0Y2gge1xuICAgIH1cbiAgICBjb25zdCBzcmNEaXIgPSBgJHtuZXdQcm9qZWN0Um9vdH0vJHtvcHRpb25zLm5hbWV9L3NyY2A7XG5cbiAgICByZXR1cm4gbWVyZ2VXaXRoKGFwcGx5KHVybCgnLi9maWxlcycpLCBbXG4gICAgICBhcHBseVRlbXBsYXRlcyh7XG4gICAgICAgIHV0aWxzOiBzdHJpbmdzLFxuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAnZG90JzogJy4nLFxuICAgICAgfSksXG4gICAgICBtb3ZlKHNyY0RpciksXG4gICAgXSkpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBvdmVyd3JpdGVHaXRpZ25vcmUob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGdpdGlnbm9yZSA9IGAke29wdGlvbnMubmFtZX0vLmdpdGlnbm9yZWA7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhnaXRpZ25vcmUpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgZ2l0SWdub3JlQ29udGVudCA9IGhvc3QucmVhZChnaXRpZ25vcmUpO1xuICAgIGlmICghZ2l0SWdub3JlQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCAuZ2l0aWdub3JlIGNvbnRlbnQnKTtcbiAgICB9XG5cbiAgICBpZiAoZ2l0SWdub3JlQ29udGVudC5pbmNsdWRlcygnL2JhemVsLW91dFxcbicpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgbGluZXMgPSBnaXRJZ25vcmVDb250ZW50LnRvU3RyaW5nKCkuc3BsaXQoL1xcbi9nKTtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUoZ2l0aWdub3JlKTtcbiAgICBjb25zdCBjb21waWxlT3V0cHV0ID0gbGluZXMuZmluZEluZGV4KChsaW5lOiBzdHJpbmcpID0+IGxpbmUgPT09ICcjIGNvbXBpbGVkIG91dHB1dCcpO1xuICAgIHJlY29yZGVyLmluc2VydFJpZ2h0KGNvbXBpbGVPdXRwdXQsICdcXG4vYmF6ZWwtb3V0Jyk7XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuXG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVdvcmtzcGFjZUZpbGVUb1VzZUJhemVsQnVpbGRlcihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qge25hbWV9ID0gb3B0aW9ucztcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gYCR7bmFtZX0vYW5ndWxhci5qc29uYDtcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHdvcmtzcGFjZVBhdGgpKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgV29ya3NwYWNlIGZpbGUgJHt3b3Jrc3BhY2VQYXRofSBub3QgZm91bmQuYCk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUJ1ZmZlciA9IGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKSAhO1xuICAgIGNvbnN0IHdvcmtzcGFjZUpzb25Bc3QgPSBwYXJzZUpzb25Bc3Qod29ya3NwYWNlQnVmZmVyLnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcHJvamVjdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdCh3b3Jrc3BhY2VKc29uQXN0LCAncHJvamVjdHMnKTtcbiAgICBpZiAoIXByb2plY3RzKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignRXhwZWN0IHByb2plY3RzIGluIGFuZ3VsYXIuanNvbiB0byBiZSBhbiBPYmplY3QnKTtcbiAgICB9XG4gICAgY29uc3QgcHJvamVjdCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIG5hbWUpO1xuICAgIGlmICghcHJvamVjdCkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEV4cGVjdGVkIHByb2plY3RzIHRvIGNvbnRhaW4gJHtuYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUod29ya3NwYWNlUGF0aCk7XG4gICAgY29uc3QgaW5kZW50ID0gNjtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIHByb2plY3QgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcsIHtcbiAgICAgICAgICAnYnVpbGQnOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsndGFyZ2V0TGFiZWwnOiAnLy9zcmM6YnVuZGxlLmpzJywgJ2JhemVsQ29tbWFuZCc6ICdidWlsZCd9LFxuICAgICAgICAgICAgJ2NvbmZpZ3VyYXRpb25zJzogeydwcm9kdWN0aW9uJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpidW5kbGUnfX1cbiAgICAgICAgICB9LFxuICAgICAgICAgICdzZXJ2ZSc6IHtcbiAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgICdvcHRpb25zJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpkZXZzZXJ2ZXInLCAnYmF6ZWxDb21tYW5kJzogJ3J1bid9LFxuICAgICAgICAgICAgJ2NvbmZpZ3VyYXRpb25zJzogeydwcm9kdWN0aW9uJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpwcm9kc2VydmVyJ319XG4gICAgICAgICAgfSxcbiAgICAgICAgICAnZXh0cmFjdC1pMThuJzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6ZXh0cmFjdC1pMThuJyxcbiAgICAgICAgICAgICdvcHRpb25zJzogeydicm93c2VyVGFyZ2V0JzogYCR7bmFtZX06YnVpbGRgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ3Rlc3QnOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsnYmF6ZWxDb21tYW5kJzogJ3Rlc3QnLCAndGFyZ2V0TGFiZWwnOiAnLy9zcmMvLi4uJ31cbiAgICAgICAgICB9LFxuICAgICAgICAgICdsaW50Jzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6dHNsaW50JyxcbiAgICAgICAgICAgICdvcHRpb25zJzoge1xuICAgICAgICAgICAgICAndHNDb25maWcnOiBbJ3NyYy90c2NvbmZpZy5hcHAuanNvbicsICdzcmMvdHNjb25maWcuc3BlYy5qc29uJ10sXG4gICAgICAgICAgICAgICdleGNsdWRlJzogWycqKi9ub2RlX21vZHVsZXMvKionXVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcblxuICAgIGNvbnN0IGUyZSA9IGAke29wdGlvbnMubmFtZX0tZTJlYDtcbiAgICBjb25zdCBlMmVOb2RlID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMgYXMgSnNvbkFzdE9iamVjdCwgZTJlKTtcbiAgICBpZiAoZTJlTm9kZSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGUyZU5vZGUgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcsIHtcbiAgICAgICAgICAgICdlMmUnOiB7XG4gICAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgICAgJ29wdGlvbnMnOiB7J2JhemVsQ29tbWFuZCc6ICd0ZXN0JywgJ3RhcmdldExhYmVsJzogJy8vZTJlOmRldnNlcnZlcl90ZXN0J30sXG4gICAgICAgICAgICAgICdjb25maWd1cmF0aW9ucyc6IHsncHJvZHVjdGlvbic6IHsndGFyZ2V0TGFiZWwnOiAnLy9lMmU6cHJvZHNlcnZlcl90ZXN0J319XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ2xpbnQnOiB7XG4gICAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOnRzbGludCcsXG4gICAgICAgICAgICAgICdvcHRpb25zJzogeyd0c0NvbmZpZyc6ICdlMmUvdHNjb25maWcuZTJlLmpzb24nLCAnZXhjbHVkZSc6IFsnKiovbm9kZV9tb2R1bGVzLyoqJ119XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBAYW5ndWxhci9iYXplbCByZXF1aXJlcyBtaW5pbXVtIHZlcnNpb24gb2YgcnhqcyB0byBiZSA2LjQuMC4gVGhpcyBmdW5jdGlvblxuICogdXBncmFkZXMgdGhlIHZlcnNpb24gb2YgcnhqcyBpbiBwYWNrYWdlLmpzb24gaWYgbmVjZXNzYXJ5LlxuICovXG5mdW5jdGlvbiB1cGdyYWRlUnhqcyhvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSBgJHtvcHRpb25zLm5hbWV9L3BhY2thZ2UuanNvbmA7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbikudG9TdHJpbmcoKTtcbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGpzb25Bc3QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBkZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RlcGVuZGVuY2llcycpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGRlcHMpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIGRlcGVuZGVuY2llcyBpbiAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCByeGpzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgJ3J4anMnKTtcbiAgICBpZiAoIXJ4anMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgcnhqcyBpbiBkZXBlbmRlbmNpZXMgb2YgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSByeGpzLnZhbHVlIGFzIHN0cmluZzsgIC8vIHZhbHVlIGNhbiBiZSB2ZXJzaW9uIG9yIHJhbmdlXG4gICAgY29uc3QgbWF0Y2ggPSB2YWx1ZS5tYXRjaCgvKFxcZCkrXFwuKFxcZCkrLihcXGQpKyQvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFtfLCBtYWpvciwgbWlub3JdID0gbWF0Y2g7XG4gICAgICBpZiAobWFqb3IgPCAnNicgfHwgKG1ham9yID09PSAnNicgJiYgbWlub3IgPCAnNCcpKSB7XG4gICAgICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KHJlY29yZGVyLCBkZXBzLCAncnhqcycsICd+Ni40LjAnKTtcbiAgICAgICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKFxuICAgICAgICAgICdDb3VsZCBub3QgZGV0ZXJtaW5lIHZlcnNpb24gb2Ygcnhqcy4gXFxuJyArXG4gICAgICAgICAgJ1BsZWFzZSBtYWtlIHN1cmUgdGhhdCB2ZXJzaW9uIGlzIGF0IGxlYXN0IDYuNC4wLicpO1xuICAgIH1cbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBXaGVuIHVzaW5nIEFuZ3VsYXIgTlBNIHBhY2thZ2VzIGFuZCBidWlsZGluZyB3aXRoIEFPVCBjb21waWxhdGlvbiwgbmdjXG4gKiByZXF1aXJlcyBuZ3N1bWFtcnkgZmlsZXMgYnV0IHRoZXkgYXJlIG5vdCBzaGlwcGVkLiBUaGlzIGZ1bmN0aW9uIGFkZHMgYVxuICogcG9zdGluc3RhbGwgc3RlcCB0byBnZW5lcmF0ZSB0aGVzZSBmaWxlcy5cbiAqL1xuZnVuY3Rpb24gYWRkUG9zdGluc3RhbGxUb0dlbmVyYXRlTmdTdW1tYXJpZXMob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IGFuZ3VsYXJNZXRhZGF0YVRzQ29uZmlnID0gYCR7b3B0aW9ucy5uYW1lfS9hbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb25gO1xuICAgIGlmICghaG9zdC5leGlzdHMoYW5ndWxhck1ldGFkYXRhVHNDb25maWcpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gYCR7b3B0aW9ucy5uYW1lfS9wYWNrYWdlLmpzb25gO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pLnRvU3RyaW5nKCk7XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChjb250ZW50KSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHNjcmlwdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnc2NyaXB0cycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoc2NyaXB0cykge1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIoXG4gICAgICAgICAgcmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsICduZ2MgLXAgLi9hbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nLCA0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIoXG4gICAgICAgICAgcmVjb3JkZXIsIGpzb25Bc3QsICdzY3JpcHRzJywge1xuICAgICAgICAgICAgcG9zdGluc3RhbGw6ICduZ2MgLXAgLi9hbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgMik7XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBleHRlcm5hbFNjaGVtYXRpYyhcbiAgICAgICAgICAnQHNjaGVtYXRpY3MvYW5ndWxhcicsICduZy1uZXcnLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICB9KSxcbiAgICAgIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICB1cGdyYWRlUnhqcyhvcHRpb25zKSxcbiAgICAgIGFkZERldkFuZFByb2RNYWluRm9yQW90KG9wdGlvbnMpLFxuICAgICAgc2NoZW1hdGljKCdiYXplbC13b3Jrc3BhY2UnLCBvcHRpb25zLCB7XG4gICAgICAgIHNjb3BlOiBvcHRpb25zLm5hbWUsXG4gICAgICB9KSxcbiAgICAgIG92ZXJ3cml0ZUdpdGlnbm9yZShvcHRpb25zKSxcbiAgICAgIGFkZFBvc3RpbnN0YWxsVG9HZW5lcmF0ZU5nU3VtbWFyaWVzKG9wdGlvbnMpLFxuICAgICAgdXBkYXRlV29ya3NwYWNlRmlsZVRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnMpLFxuICAgIF0pO1xuICB9O1xufVxuIl19