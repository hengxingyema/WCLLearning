/**
 * Created by wujiangwei on 2016/11/25.
 */
var AV = require('leanengine');
var Promise = require('bluebird');
var _ = require('underscore');
var Q = require('q');

var redisClient = require('../redis').redisClient;

var tempUserSQL = AV.Object.extend('tempUser');
var releaseTaskSQL = AV.Object.extend('releaseTaskObject');
var receiveTaskSQL = AV.Object.extend('receiveTaskObject');
var mackTaskInfoSQL = AV.Object.extend('mackTaskInfo');
var IOSAppInfoSQL = AV.Object.extend('IOSAppInfo');
var integralWallTaskObjectSQL = AV.Object.extend('integralWallTaskObject'); // 积分墙任务库

/*
 * 缓存关联数据示例
 *
 * 这种模式适合被关联的数据量少、查询频繁、不常修改，或者关联结构非常复杂（需要多次查询或需要对被关联对象做计算）的情况，
 * 应用合理的话可以减少对云存储的查询次数、缩短请求的处理时间，但要注意当关联对象被修改时要及时刷新缓存，否则会出现数据不同步的情况。
 *
 * tempUser,User
 * releaseTask,receiveTask
 * 缓存这些数据，且用户对象上的数据也不常变化（可以通过 User 的 afterUpdate Hook 来刷新缓存）。
 */

/* 在 User 被修改后删除缓存 */
AV.Cloud.afterUpdate('_User', function(request) {
    redisClient.setAsync(redisObjectKey(request.object.id), JSON.stringify(request.object)).catch(console.error);
});
/* 在 tempUser 被修改后删除缓存 */
AV.Cloud.afterUpdate('tempUser', function(request) {
    // console.log('tempUser afterUpdate ', request.object.id);
    redisClient.setAsync(redisObjectKey(request.object.id), JSON.stringify(request.object)).catch(console.error);
});
/* 在 releaseTaskObject 被修改后删除缓存 */
AV.Cloud.afterUpdate('releaseTaskObject', function(request) {
    // console.log('releaseTaskObject afterUpdate ', request.object.id);
    redisClient.setAsync(redisObjectKey(request.object.id), JSON.stringify(request.object)).catch(console.error);
});
/* 在 receiveTaskObject 被修改后删除缓存 */
AV.Cloud.afterUpdate('receiveTaskObject', function(request) {
    // console.log('receiveTaskObject afterUpdate ', request.object.id);
    redisClient.setAsync(redisObjectKey(request.object.id), JSON.stringify(request.object)).catch(console.error);
});
/* 在 receiveTaskObject 被修改后删除缓存 */
AV.Cloud.afterDelete('receiveTaskObject', function(request) {
    // console.log('receiveTaskObject afterDelete ', request.object.id);
    redisClient.delAsync(redisObjectKey(request.object.id)).catch(console.error);
});
/* 在 mackTaskInfo 被修改后删除缓存 */
// AV.Cloud.afterUpdate('mackTaskInfo', function(request) {
// redisClient.setAsync(redisObjectKey(request.object.id), JSON.stringify(request.object)).catch(console.error);
// });
/* 在 IOSAppInfoSQL 被修改后删除缓存 */
AV.Cloud.afterUpdate('IOSAppInfo', function(request) {
    redisClient.setAsync(redisObjectKey(request.object.id), JSON.stringify(request.object)).catch(console.error);
});

AV.Cloud.afterUpdate('integralWallTaskObject', function(request) {
    redisClient.setAsync(redisObjectKey(request.object.id), JSON.stringify(request.object)).catch(console.error);
});

function cacheToObject(cachedObject, objectType, objectId) {

    // console.log(objectId + ' is (' + objectType + ') exist ' + cachedObject);

    // 反序列化为 AV.Object
    if(objectType == '_User'){
        return new AV.User(JSON.parse(cachedObject), {parse: true});
    }else if(objectType == 'tempUser'){
        return new tempUserSQL(JSON.parse(cachedObject), {parse: true});
    }else if(objectType == 'releaseTaskObject'){
        return new releaseTaskSQL(JSON.parse(cachedObject), {parse: true});
    }else if(objectType == 'receiveTaskObject'){
        return new receiveTaskSQL(JSON.parse(cachedObject), {parse: true});
    }else if(objectType == 'mackTaskInfo'){
        return new mackTaskInfoSQL(JSON.parse(cachedObject), {parse: true});
    }else if(objectType == 'IOSAppInfo'){
        return new IOSAppInfoSQL(JSON.parse(cachedObject), {parse: true});
    }else if(objectType == 'integralWallTaskObject'){
        return new integralWallTaskObjectSQL(JSON.parse(cachedObject), {parse: true});
    }

    throw new Error('数据类型不对 ', objectType);
}

function queryObjectAndCache(objectId, objectType) {
    // query 查询结果
    if(objectType == '_User'){
        return new AV.Query(AV.User).get(objectId).then(function(user) {
            if (user) {
                // 将序列化后的 JSON 字符串存储到 LeanCache
                redisClient.setAsync(redisObjectKey(objectId), JSON.stringify(user)).catch(console.error);
            }
            return user;
        }, function (error) {
            //object 不存在
            // redisClient.setAsync(redisObjectKey(objectId), JSON.stringify({'objectId':objectId, 'error':error.message, 'objectType':objectType})).catch(console.error);

            throw error;
        });
    }else if(objectType == 'tempUser'){
        return new AV.Query(tempUserSQL).get(objectId).then(function(tempUser) {
            if (tempUser) {
                // 将序列化后的 JSON 字符串存储到 LeanCache
                redisClient.setAsync(redisObjectKey(objectId), JSON.stringify(tempUser)).catch(console.error);
            }
            return tempUser;
        }, function (error) {
            //object 不存在
            // redisClient.setAsync(redisObjectKey(objectId), JSON.stringify({'objectId':objectId, 'error':error.message, 'objectType':objectType})).catch(console.error);
            throw error;
        });
    }else if(objectType == 'releaseTaskObject'){
        return new AV.Query(releaseTaskSQL).get(objectId).then(function(releaseTask) {
            if (releaseTask) {
                // 将序列化后的 JSON 字符串存储到 LeanCache
                redisClient.setAsync(redisObjectKey(objectId), JSON.stringify(releaseTask)).catch(console.error);
            }
            return releaseTask;
        }, function (error) {
            throw error;
        });
    }else if(objectType == 'receiveTaskObject'){
        return new AV.Query(receiveTaskSQL).get(objectId).then(function(receiveTask) {
            if (receiveTask) {
                // 将序列化后的 JSON 字符串存储到 LeanCache
                redisClient.setAsync(redisObjectKey(objectId), JSON.stringify(receiveTask)).catch(console.error);
            }
            return receiveTask;
        }, function (error) {
            //object 不存在
            // redisClient.setAsync(redisObjectKey(objectId), JSON.stringify({'objectId':objectId, 'error':error.message, 'objectType':objectType})).catch(console.error);
            throw error;
        });
    }
    // else if(objectType == 'mackTaskInfo'){
    //     return new AV.Query(mackTaskInfoSQL).get(objectId).then(function(mackTaskInfo) {
    //         if (mackTaskInfo) {
    //             // 将序列化后的 JSON 字符串存储到 LeanCache
    //             redisClient.setAsync(redisObjectKey(objectId), JSON.stringify(mackTaskInfo)).catch(console.error);
    //         }
    //         return mackTaskInfo;
    //     }, function (error) {
    //         //object 不存在
    //         redisClient.setAsync(redisObjectKey(objectId), JSON.stringify({'objectId':objectId, 'error':error.message, 'objectType':objectType})).catch(console.error);
    //         throw error;
    //     });
    // }
    else if(objectType == 'IOSAppInfo'){
        return new AV.Query(IOSAppInfoSQL).get(objectId).then(function(IOSAppInfo) {
            if (IOSAppInfo) {
                // 将序列化后的 JSON 字符串存储到 LeanCache
                redisClient.setAsync(redisObjectKey(objectId), JSON.stringify(IOSAppInfo)).catch(console.error);
            }
            return IOSAppInfo;
        }, function (error) {
            //object 不存在
            // redisClient.setAsync(redisObjectKey(objectId), JSON.stringify({'objectId':objectId, 'error':error.message, 'objectType':objectType})).catch(console.error);
            throw error;
        });
    }
    else if(objectType == 'integralWallTaskObject'){
        return new AV.Query(integralWallTaskObjectSQL).get(objectId).then(function(integralWallTaskObject) {
            if (integralWallTaskObject) {
                // 将序列化后的 JSON 字符串存储到 LeanCache
                redisClient.setAsync(redisObjectKey(objectId), JSON.stringify(integralWallTaskObject)).catch(console.error);
            }
            return integralWallTaskObject;
        }, function (error) {
            //object 不存在
            // redisClient.setAsync(redisObjectKey(objectId), JSON.stringify({'objectId':objectId, 'error':error.message, 'objectType':objectType})).catch(console.error);
            throw error;
        });
    }
}


/* 秒杀任务开始 */
exports.seckillTask =  function(objectId, objectType, getTaskUserId, getTaskCount) {
    //需要让redis的命令是原子操作
    //队列抢任务
    var multi = redisClient.multi();
    multi.get(objectId);
    multi.lrange(objectId + ':gettingUsers', 0, -1);
    multi.get(objectId + ':redisRemainCount');
    return Q.ninvoke(multi, 'exec').then(function(cacheObject) {
        var cachedLeanObject = cacheToObject(cacheObject[0], objectType, objectId);
        var gettingTaskUsers = cacheObject[1];

        if(cachedLeanObject.get('remainCount') == undefined || cachedLeanObject.get('remainCount') <= 0){
            //task not enough
            throw new Error('任务已经被抢完');
        }else {
            var multiInside = redisClient.multi();

            //记录第一次秒杀时，有多少剩余任务数量
            var redisRemainCount = cacheObject[2];
            if(redisRemainCount == undefined || redisRemainCount == 0){
                redisRemainCount = cachedLeanObject.get('remainCount');
                //set immediately
                //会被多少set（秒杀时）
                multiInside.set(objectId + ':redisRemainCount', redisRemainCount);
                // console.log(getTaskUserId + ' ----- ' + objectId + ' redis remainCount = ' + redisRemainCount);
            }

            if(gettingTaskUsers  == undefined || _.indexOf(gettingTaskUsers, getTaskUserId) == -1){
                if(gettingTaskUsers == undefined || redisRemainCount > gettingTaskUsers.length){
                    //可以领取多少任务
                    // console.log(getTaskUserId + ' ----- ' + objectId + ' gettingTaskUsers length ' + gettingTaskUsers.length);
                    var exactGetTaskCount = getTaskCount;
                    if(redisRemainCount - gettingTaskUsers.length < getTaskCount){
                        throw new Error('任务数量不足,只剩' + redisRemainCount - gettingTaskUsers.length + '条任务');
                    }else {
                        //领取多个任务时，push 多个userId
                        for(var i = 0; i < exactGetTaskCount; i ++){
                            multiInside.rpush(objectId + ':gettingUsers', getTaskUserId);
                        }

                        // console.log('get task succeed ' +  getTaskUserId + ' and exact get task count = ', exactGetTaskCount);

                        //执行任务
                        return Q.ninvoke(multiInside, 'exec');
                    }
                }else {
                    //task not enough
                    throw new Error('手慢了哦，任务刚刚被抢完了');
                }
            }else {
                //had get task
                throw new Error('已经在抢任务中了');
            }
        }
    });
};

// 释放抢任务的队列池
exports.releaseRedisTask = function(objectId, revokeTaskUserId, remainCount) {
    //需要让redis的命令是原子操作
    //队列抢任务
    var multi = redisClient.multi();
    multi.lrange(objectId + ':gettingUsers', 0, -1);
    return Q.ninvoke(multi, 'exec').then(function(gettingTaskUsers) {
        var multiInside = redisClient.multi();
        // var needRemoveCount = 0;
        // for(var i = 0; i < gettingTaskUsers.length; i++){
        //     if(gettingTaskUsers[i] === releaseTaskUserId){
        //         needRemoveCount++;
        //     }
        // }
        console.log(revokeTaskUserId + ' ----- ' + objectId + ' redis revoke task = ' + remainCount);
        multiInside.lrem(objectId + ':gettingUsers', remainCount, revokeTaskUserId);
        //执行任务
        Q.ninvoke(multiInside, 'exec').then(function (result) {
            console.log(revokeTaskUserId + ' ----- ' + objectId + ' redis revoke succeed count = ' + result);
        }, function (error) {
            console.error('----- redis give up task update redis failed， ', error.message);
        });
    });
};


exports.fetchLeanObjectFromCache =  function(objectId, objectType) {
    return redisClient.getAsync(objectId).then(function(cachedObject) {
        if (cachedObject) {
            // 反序列化为 AV.Object
            return cacheToObject(cachedObject, objectType, objectId);
        } else {
            return queryObjectAndCache(objectId, objectType);
        }
    });
};

function queryMissedObjects(missObjectIds, objectType) {
    // 反序列化为 AV.Object
    if(objectType == '_User'){
        return new AV.Query(AV.User).containedIn('objectId', missObjectIds).find();
    }else if(objectType == 'tempUser'){
        return new AV.Query(tempUserSQL).containedIn('objectId', missObjectIds).find();
    }else if(objectType == 'releaseTaskObject'){
        return new AV.Query(releaseTaskSQL).containedIn('objectId', missObjectIds).find();
    }else if(objectType == 'receiveTaskObject'){
        return new AV.Query(receiveTaskSQL).containedIn('objectId', missObjectIds).find();
    }else if(objectType == 'mackTaskInfo'){
        return new AV.Query(mackTaskInfoSQL).containedIn('objectId', missObjectIds).find();
    }else if(objectType == 'IOSAppInfo'){
        return new AV.Query(IOSAppInfoSQL).containedIn('objectId', missObjectIds).find();
    }else if(objectType == 'integralWallTaskObject'){
        return new AV.Query(integralWallTaskObjectSQL).containedIn('objectId', missObjectIds).find();
    }

    throw new Error('数据类型不对 ', objectType);
}

/* 从缓存中读取一组 Object, 如果没有找到则从云存储中查询（会进行去重并合并为一个查询）*/
exports.fetchObjectsFromCache = function(objectIds, objectType) {
    // 先从 LeanCache 中查询
    return redisClient.mgetAsync(_.uniq(objectIds).map(redisObjectKey)).then(function(cachedUsers) {
        var parsedObjects = cachedUsers.map(function(cachedObject) {
            // 反序列化为 AV.Object
            return cacheToObject(cachedObject, objectType, 'objects');
        });

        // 找到 LeanCache 中没有缓存的那些 User
        var missObjectIds = _.uniq(objectIds.filter(function(objectId) {
            return !_.find(parsedObjects, {id: objectId});
        }));

        return Promise.try(function() {
            if (missObjectIds.length) {
                // 从云存储中查询 LeanCache 中没有的 Object
                return queryMissedObjects(missObjectIds, objectType);
            } else {
                return [];
            }
        }).then(function(latestObjects) {
            if (latestObjects.length) {
                // 将从云存储中查询到的 User 缓存到 LeanCache, 此处为异步
                redisClient.msetAsync(_.flatten(latestObjects.map(function(leanObject) {
                    return [redisObjectKey(leanObject.id), JSON.stringify(leanObject)];
                }))).catch(console.error);
            }

            // 将来自缓存和来自云存储的用户组合到一起作为结果返回
            return objectIds.map(function(objectId) {
                return _.find(parsedObjects, {id: objectId}) || _.find(latestObjects, {id: objectId});
            });
        });
    });
};

/* 存储在 LeanCache 中的键名，值是经过 JSON 序列化的 AV.Object */
function redisObjectKey(objectId) {
    return objectId;
}

/*
 * 更进一步
 *
 * - 如果数据量较大，担心占用过多内存，可以考虑为缓存设置过期时间。
 * - 其实获取一个 User 是获取一组 User 的特例，完全可以用 `fetchUsersFromCache([id])` 代替 `fetchUserFromCache(id)`.
 * - 考虑到被关联的对象不存在的情况，会反复地从云存储查询这个用户，所以设置一个特殊的、表示用户不存在的值缓存到 LeanCache.X
 * - 已经设置不存在的情况到缓存里（error字段存在）X
 * ！！！！！
 * - New: 不存在则不存在，不在redis里写入特殊字段，这样是为了在业务逻辑层捕获到错误信息，而不是在业务逻辑层处理相关异常字段！！！
 */