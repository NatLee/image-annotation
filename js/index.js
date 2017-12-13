var ary = [];
var imgOriH;
var imgOriW;
var imgDetectFlag = true;

$.ajaxSettings.async = false;

expire_days = 365;
var d = new Date();
d.setTime(d.getTime() + (expire_days * 24 * 60 * 60 * 1000));
var expires = "expires=" + d.toGMTString();

var url = "https://api.imgur.com/3/album/komU7/images";
var headers = {
	'Accept': '/',
    'Content-Type': 'application/json',
    'Authorization': 'Client-ID 0ab461a00db6f5f'
};

//var imgURL = $.get('https://ani-face.appspot.com/getImg.php');
var imgURL = '';
jQuery.ajax({
	url: url,
	type: 'GET',
	headers: headers
}).done(function(data) {
	console.log(data);
	var r = Math.floor(Math.random() * data.data.length + 1);
	console.log(r);
	var id = data.data[r]['id'];
	var link = data.data[r]['link'];
	//console.log(id);
	//console.log(link);
    imgURL = link;
});


$("img").attr("src", imgURL.responseText);
var fixTop = $('img')[0].offsetTop;
var fixLeft = $('img')[0].offsetLeft;

var imgName = imgURL.responseText.split('https://i.imgur.com/')[1];

//USER NAME
var userName = document.getElementById("userName").value;
var cookieUserName;
try{
    cookieUserName = document.cookie.split('userName=')[1].split(';')[0];
    if(cookieUserName){
        userName = cookieUserName;
        document.getElementById("userName").value = userName;
    }
}catch(err){
    //alert('請輸入你的名字！')
    swal("請輸入你的名字！", "框框可以在左下方找到：）");
}

//COUNT
var count;
try{
  count = document.cookie.split('count=')[1].split(';')[0];
  document.getElementById('count').innerHTML = count;
}catch(err){
  if(!count || count=='NaN'){
    count = 0;
    document.getElementById('count').innerHTML = count;
  }else if(count>=0){
    document.getElementById('count').innerHTML = count;
  }
}


function clickEvent(e) {
    document.getElementById("submit").disabled = true;
    swal({
        title: "你確定嗎?",
        text: "一旦按下OK，此次結果將會送出。",
        icon: "warning",
        buttons: ["不要", true],
        dangerMode: true,
    }).then((willDelete) => {
        if (willDelete) {
            ary = [];

            var imgH = $('img').height();
            var imgW = $('img').width();
            var HScale = 1;
            var WScale = 1;
            var scale = 1;
            if(!imgDetectFlag){
                HScale = imgH / imgOriH;
                WScale = imgW / imgOriW;
                scale = Math.sqrt(HScale * WScale);
            }

            var boxes = $(".resizeDiv");
            var googleForm = 'https://docs.google.com/forms/d/e/1FAIpQLScGl6BSyRiCaIVt67Dkzlr7okTQQ3Wnt7VBpivvVG5hbly8tA/formResponse?';
            var entryImgName = 'entry.758844231=';
            var entryBoxHeightOffset = 'entry.1881696409=';
            var entryBoxLeftOffset = 'entry.669378490=';
            var entryBoxSize = 'entry.676533522=';
            var entryUser = 'entry.1877828300=';
            userName = document.getElementById("userName").value;
            var entryUserSend = entryUser + userName;
            if (!boxes.length) { // 色即是空
                $.get(googleForm + entryImgName + imgName + '&' + entryBoxHeightOffset + '-1&' + entryBoxLeftOffset + '-1&' + entryBoxSize + '-1&' + entryUserSend);
            }
            for (var i = 0; i < boxes.length; i++) {
                var boxTop = parseInt((boxes[i]["offsetTop"] - fixTop) / HScale);
                var boxLeft = parseInt((boxes[i]["offsetLeft"] - fixLeft) / WScale);
                var boxSize = parseInt(boxes[i]["offsetWidth"] / scale);
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
            document.cookie = "userName=" + userName + ";" + expires;
            document.cookie = "count=" + (parseInt(count) + 1) + ";" + expires;

            swal("送出成功！請繼續努力！", {
                icon: "success",
            }).then((value) => {
                location.reload();
            });
        } else {
            swal("請再次確認位置。");
            document.getElementById("submit").disabled = false;
        }
    });
}

$(function() {
    $(".resizeDiv").draggable({
        stop: stopEvent
    }).resizable({
        aspectRatio: 1 / 1,
        resize: stopEvent
    });
});

function addEvent(e) {
    $("body").append('<div class="resizeDiv"></div>');
    $(".resizeDiv").draggable({
        stop: stopEvent
    }).resizable({
        aspectRatio: 1 / 1,
        resize: stopEvent
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

function rankEvent(e) { // button跳到排行榜頁面
    //window.location.href = 'https://ani-face.appspot.com/rank.php';
    window.location.href = 'rank.html';
}

function detailsEvent(e) {
    swal({
        title: "這是個說明",
        text: "框頭，整顆頭！YEE！",
        icon: "info",
    });
}

function zoomInEvent(e) {
    if(imgDetectFlag){
        imgOriH = $("img")[0].height;
        imgOriW = $("img")[0].width;
        imgDetectFlag = false;
    }
    $("img")[0].height = $("img")[0].height * 1.1;
}

function zoomOutEvent(e) {
    if(imgDetectFlag){
        imgOriH = $("img")[0].height;
        imgOriW = $("img")[0].width;
        imgDetectFlag = false;
    }
    if($('img').height() > $(".resizeDiv")[0].offsetHeight && $('img').width() > $(".resizeDiv")[0].offsetWidth){
        $("img")[0].height = $("img")[0].height * 0.9;
    }else{
        swal({
            title: "有點疑問",
            text: "縮這麼小看得到嗎？",
            icon: "info",
        });
    }

}
