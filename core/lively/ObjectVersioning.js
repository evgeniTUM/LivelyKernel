module('lively.ObjectVersioning').requires().toRun(function() {

Object.extend(lively.ObjectVersioning, {
    init: function() {
        lively.CurrentObjectTable = [];
        lively.Versions = []; // a linear history (for now)
        
        lively.Versions.push(lively.CurrentObjectTable);
    },
    addObject: function(target) {        
        // proxies are fully virtual objects: don't point to their target, but
        // refer to it by __objectID
        var id, proxy;
        
        if (target !== Object(target)) {
            throw new TypeError('Primitive objects shouldn\'t be wrapped');
        }
        
        lively.CurrentObjectTable.push(target);
        
        proxy = Proxy({}, this.versioningProxyHandler());
        id = lively.CurrentObjectTable.length - 1;
        
        proxy.__objectID = id;
        return proxy;
    },
    isProxy: function(obj) {
        return obj.__objectID !== undefined ? true : false;
    },
    getObjectForProxy: function(proxy, optObjectTable) {
        var objectTable = optObjectTable || lively.CurrentObjectTable;
        return objectTable[proxy.__objectID];
    },
    setObjectForProxy: function(target, proxy, optObjectTable) {
        var objectTable = optObjectTable || lively.CurrentObjectTable;
        objectTable[proxy.__objectID] = target;
    },
    versioningProxyHandler: function() {
        return {
            // first parameter of >>set: and >>get: is the proxy's target
            // but as these proxies are fully virtual, it's an empty object
            set: function(virtualTarget, name, value, receiver) {
                var targetObject,
                    newObject;
                
                // proxy meta-information
                if (name === '__objectID') {
                    this[name] = value;
                    return true;
                }
                                                
                targetObject = lively.ObjectVersioning.getObjectForProxy(receiver);
                
                // copy-on-first-write when object is commited in previous version
                if (Object.isFrozen(targetObject)) {
                    newObject = Object.clone(targetObject);
                    lively.ObjectVersioning.setObjectForProxy(newObject, receiver);
                    targetObject = newObject;
                }
                       
                targetObject[name] = value;
                
                return true;
            },
            get: function(virtualTarget, name, receiver) {
                var targetObject,
                    result;
                
                // proxy meta-information
                if (name === '__objectID') {
                    return this[name];
                }
                                                
                targetObject = lively.ObjectVersioning.getObjectForProxy(receiver);                
                return targetObject[name]; 
            },
        };
    },
    commitVersion: function() {
        var previousVersion,
            nextVersion;
        
        previousVersion = lively.CurrentObjectTable;
        nextVersion = Object.clone(lively.CurrentObjectTable);
        lively.Versions.push(nextVersion);
        
        // freeze all objects as previous versions shouldn't change,
        // so objects need to be copied on (first) write
        nextVersion.forEach(function (ea) {
            Object.freeze(ea);
        })
                
        lively.CurrentObjectTable = nextVersion;
        
        return previousVersion; 
    },
    undo: function() {
        var previousVersion = this.previousVersion();
        if (!previousVersion) {
            throw new Error('Can\'t undo: No previous version.');
        }
        lively.CurrentObjectTable = previousVersion;
    },
    redo: function() {
        var followingVersion = this.followingVersion();
        if (!followingVersion) {
            throw new Error('Can\'t redo: No next version.');
        }
        lively.CurrentObjectTable = this.followingVersion();
    },
    previousVersion: function() {
        var index = lively.Versions.indexOf(lively.CurrentObjectTable) - 1;
        if (index < 0) {
            return undefined;
        }
        return lively.Versions[index];
    },
    followingVersion: function() {
        var index = lively.Versions.indexOf(lively.CurrentObjectTable) + 1;
        if (index >= lively.Versions.size()) {
            return undefined;
        }
        return lively.Versions[index];
    },
});

lively.ObjectVersioning.init();

});