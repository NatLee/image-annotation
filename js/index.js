
var ary = [];
var fixTop = 105;
var fixLeft = 8;


$.ajaxSettings.async = false;

/*
// JSON WAY
var JData = $.getJSON('https://raw.githubusercontent.com/NatLee/test/master/yee.json');

var len = JData.responseJSON.length;
var num = Math.floor((Math.random() * len));
var imgName = JData.responseJSON[num];

$("img").attr("src", "https://i.imgur.com/" + imgName + ".jpg");
*/

var imgURL = $.get('https://b3bb6390.ngrok.io/yee/yee.php');
$("img").attr("src", imgURL.response);
var imgName = imgURL.response.split('https://i.imgur.com/')[1];


var userName = document.getElementById("userName").value;
var cookieUserName = document.cookie.split('&')[1];

if(!userName && cookieUserName){
    document.getElementById("userName").value = cookieUserName;
}

function clickEvent(e) {
    ary = [];
    var boxes = $(".resizeDiv");
    var googleForm = 'https://docs.google.com/forms/d/e/1FAIpQLScGl6BSyRiCaIVt67Dkzlr7okTQQ3Wnt7VBpivvVG5hbly8tA/formResponse?';
    var entryImgName = 'entry.758844231=';
    var entryBoxHeightOffset = 'entry.1881696409=';
    var entryBoxLeftOffset = 'entry.669378490=';
    var entryBoxSize = 'entry.676533522=';
    var entryUser = 'entry.1877828300=';

    userName = document.getElementById("userName").value;

    var entryUserSend = entryUser + userName;

    if(!boxes.length){ // 色即是空
        $.get(googleForm + entryImgName + imgName + '&' + entryBoxHeightOffset + '-1&' + entryBoxLeftOffset + '-1&' + entryBoxSize + '-1&' + userNameSend);
    }

    for (var i = 0; i < boxes.length; i++) {

        var boxTop = boxes[i]["offsetTop"] - fixTop;
        var boxLeft = boxes[i]["offsetLeft"] - fixLeft;
        var boxSize = boxes[i]["offsetWidth"];
        var obj = {
            top: boxTop,
            left: boxLeft,
            size: boxSize
        };
        ary.push(obj);
        var entryImgNameSend = entryImgName + imgName;
        var entryBoxHeightOffsetSend = entryBoxHeightOffset + boxTop;
        var entryBoxLeftOffsetSend = entryBoxLeftOffset + boxLeft;
        var entryBoxSizeSend = entryBoxSize + boxSize;

        var googleFormSend = googleForm + entryImgNameSend + '&' + entryBoxHeightOffsetSend + '&' + entryBoxLeftOffsetSend + '&' + entryBoxSizeSend + '&' + entryUserSend;

        $.get(googleFormSend);

    }
    //console.log(ary);
    document.cookie = "userName=&" + userName + "&";
    //console.log(userName)

    alert('送出成功！請繼續努力！')
    location.reload();
}

$(function() {
    $(".resizeDiv").draggable({
        stop: stopEvent
    }).resizable({
        aspectRatio: 1 / 1
    });
});


function addEvent(e) {
    $("body").append('<div class="resizeDiv"></div>');
    $(".resizeDiv").draggable({
        stop: stopEvent
    }).resizable({
        aspectRatio: 1 / 1
    });
    $(".resizeDiv").trigger("create");
}

function stopEvent(e) {
    var top = this.offsetTop - fixTop;
    var left = this.offsetLeft - fixLeft;
    var boxHW = this.offsetWidth;
    var imgH = $('img').height();
    var imgW = $('img').width();
    //console.log(imgH,imgW)
    if (top < 0) {
        $(this).css({
            "top": fixTop
        });
    } else if (top + boxHW > imgH) {
        $(this).css({
            "top": imgH - boxHW + fixTop
        });
    }
    if (left < 0) {
        $(this).css({
            "left": fixLeft
        });
    } else if (left + boxHW > imgW) {
        $(this).css({
            "left": imgW - boxHW + fixLeft
        });
    }
}

function deleteEvent(e) {
    var len = $(".resizeDiv").length;
    if (len == 0) {
        return;
    }
    $(".resizeDiv")[len - 1].outerHTML = '';
    ary.pop()
}
