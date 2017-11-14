angular.module('starter.services', [])

.factory('taskData', function() {


});


var isPointerInPolygon = function(pointer, polygonPointers)
{
    //pointer is a struct like [pointer.x pointer.y]
    //polygon pointers is a list of pointers
    //the pointer in pointers are all not same one

    //step1:计算多边形面积
    var polygonArea = 0;
    var firstPolygonPointer = polygonPointers[0];
    for (var i = 1; i < polygonPointers.length - 1; i++){
        var pointerStart = polygonPointers[i];
        var pointerEnd = polygonPointers[i + 1];

        //三角形面积公式(a,b,c)
        //计算方法：两个向量的叉乘 = 两向量构成的平行四边形的面积
        //((a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x)) / 2
        var tempPolygonArea = Math.abs(((firstPolygonPointer.x - pointerEnd.x) * (pointerStart.y - pointerEnd.y) - (firstPolygonPointer.y - pointerEnd.y) * (pointerStart.x - pointerEnd.x)) / 2);
        polygonArea +=tempPolygonArea;
    }

    console.log('多边形面积为: ' + polygonArea);

    //计算点和每个边组成的三角形面积，如果累加起来，面积相等，则点在多边形内部
    var polygonAreaEx = 0;
    var firstPolygonPointer = pointer;
    for (var i = 0; i < polygonPointers.length; i++){
        var pointerStart = polygonPointers[i];
        var pointerEnd;
        if(i == polygonPointers.length - 1){
            pointerEnd = polygonPointers[0];
        }else {
            pointerEnd = polygonPointers[i + 1];
        }

        var tempPolygonArea = Math.abs(((firstPolygonPointer.x - pointerEnd.x) * (pointerStart.y - pointerEnd.y) - (firstPolygonPointer.y - pointerEnd.y) * (pointerStart.x - pointerEnd.x)) / 2);
        polygonAreaEx += tempPolygonArea;
    }

    if(polygonAreaEx == polygonArea){
        console.log('点在多边形内部（含边界点）');
    }else {
        console.log('点在多边形外部');
    }
};

var judgePointer = {x: 15.4555666, y:100.34};
var testPolygon = [{x: 12.3, y:76.34}, {x: 12.3, y:89.34}, {x: 15.3, y:100.34}, {x: 23.3, y:89.34}, {x: 23.3, y:76.34}];

isPointerInPolygon(judgePointer, testPolygon);



function testThreeDoors() {
    
    function getRandomDoorNumber(exceptionNumber) {
        var randomFloat = Math.random();//[0, 1)

        if(randomFloat >= 0.9){
            return getRandomDoorNumber(exceptionNumber);
        }

        if (randomFloat < 0.3){
            if(exceptionNumber == 1){
                return getRandomDoorNumber(exceptionNumber);
            }
            return 1;
        }
        if (randomFloat < 0.6){
            if(exceptionNumber == 2){
                return getRandomDoorNumber(exceptionNumber);
            }
            return 2;
        }
        if (randomFloat < 0.9){
            if(exceptionNumber == 3){
                return getRandomDoorNumber(exceptionNumber);
            }
            return 3;
        }
    }

    var totalTestCount = 100000;
    var firstHitDoor = 0;
    var noChangeHitDoor = 0;
    var changeHitDoor = 0;

    for(var i = 0; i < totalTestCount; i++){
        var tempKeyDoorNumber = getRandomDoorNumber(0);//中奖号

        var guestDoorNumber = getRandomDoorNumber(0);//观众选择号
        var presenterDoorNumber = getRandomDoorNumber(guestDoorNumber);//主持人选择号
        if(tempKeyDoorNumber == presenterDoorNumber){
            firstHitDoor++;
            //主持人中奖
            continue;
        }

        //主持人未中奖
        if(tempKeyDoorNumber == guestDoorNumber){
            //观众未改变主意中奖
            noChangeHitDoor++;
        }
        if(tempKeyDoorNumber != guestDoorNumber){
            //观众改变主意中奖
            changeHitDoor++;
        }
    }

    console.log('三门总实验次数 ' + totalTestCount + ' 次');
    console.log('主持人中奖概率 ' + firstHitDoor / totalTestCount);
    console.log('观众不改变决定中奖概览（主持人不中奖的情况下） ' + noChangeHitDoor/ (noChangeHitDoor + changeHitDoor));
    console.log('改变决定中奖次数（主持人不中奖的情况下） ' + changeHitDoor/ (noChangeHitDoor + changeHitDoor));
    
}

// testThreeDoors();