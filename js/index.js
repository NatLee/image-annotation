var ary = [];
var imgOriH;
var imgOriW;
var imgDetectFlag = true;
let imgURL;
let imgName;

// Use the waifu.im API to fetch a random image
fetch('https://api.waifu.im/search')
  .then(response => response.json())
  .then(data => {
    imgURL = data.images[0].url;
    $("img").attr("src", imgURL);
    $("img").on('load', function() {
      fixTop = this.offsetTop;
      fixLeft = this.offsetLeft;
      updateImageDimensions();
    });
    var list = imgURL.split('/');
    imgName = list[list.length-1];
  });
var fixTop = 0;
var fixLeft = 0;

//USER NAME
var userName = localStorage.getItem('userName');
if (userName) {
  document.getElementById("userName").value = userName;
} else {
  swal("請輸入你的名字！", "框框可以在左下方找到：）");
}

//COUNT
var count = localStorage.getItem('count') || 0;
document.getElementById('count').innerHTML = count;


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

            var boxes = $(".resize-div");
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
                console.log('Image Size: ' + imgW + 'x' + imgH);
                console.log('Frame Size: ' + boxSize + 'x' + boxSize);
                console.log('Frame Position: (' + boxLeft + ', ' + boxTop + ')');
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
            localStorage.setItem('userName', userName);
            var newCount = parseInt(count) + 1;
            localStorage.setItem('count', newCount);

            var rankData = JSON.parse(localStorage.getItem('rankData')) || {};
            rankData[userName] = newCount;
            localStorage.setItem('rankData', JSON.stringify(rankData));

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
    $(".resize-div").draggable({
        stop: stopEvent
    }).resizable({
        aspectRatio: 1 / 1,
        resize: stopEvent
    });
});

function addEvent(e) {
    $(".image-container").append('<div class="resize-div"><div class="position-display"></div></div>');
    $(".resize-div").draggable({
        stop: stopEvent
    }).resizable({
        aspectRatio: 1 / 1,
        resize: stopEvent
    });
    $(".resize-div").trigger("create");
}

function stopEvent(e, ui) {
    var top = this.offsetTop - fixTop;
    var left = this.offsetLeft - fixLeft;
    var boxHW = this.offsetWidth;
    var imgH = $('.main-image').outerHeight();
    var imgW = $('.main-image').outerWidth();

    if (top < 0) {
        top = 0;
        $(this).css({ "top": fixTop });
    } else if (top + boxHW > imgH) {
        top = imgH - boxHW;
        $(this).css({ "top": imgH - boxHW + fixTop });
    }

    if (left < 0) {
        left = 0;
        $(this).css({ "left": fixLeft });
    } else if (left + boxHW > imgW) {
        left = imgW - boxHW;
        $(this).css({ "left": imgW - boxHW + fixLeft });
    }

    // Update position display
    var positionText = `(${parseInt(left)}, ${parseInt(top)})`;
    $(this).find('.position-display').text(positionText);
}

function deleteEvent(e) {
    var len = $(".resize-div").length;
    if (len == 0) {
        return;
    }
    $(".resize-div")[len - 1].outerHTML = '';
    ary.pop()
}

function rankEvent(e) {
    var rankContainer = document.getElementById('rank-container');
    var anifaceContainer = document.getElementById('aniface');
    if (rankContainer.style.display === 'none') {
        updateRank();
        rankContainer.style.display = 'block';
        anifaceContainer.style.display = 'none';
    } else {
        rankContainer.style.display = 'none';
        anifaceContainer.style.display = 'block';
    }
}

function updateRank() {
    var rankData = JSON.parse(localStorage.getItem('rankData')) || {};
    var sortable = [];
    for (var user in rankData) {
        sortable.push([user, rankData[user]]);
    }

    sortable.sort(function(a, b) {
        return b[1] - a[1];
    });

    var rankBody = document.getElementById('rank-body');
    rankBody.innerHTML = '';
    for (var i = 0; i < sortable.length; i++) {
        var row = '<tr><td>' + sortable[i][0] + '</td><td>' + sortable[i][1] + '</td></tr>';
        rankBody.innerHTML += row;
    }
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
    updateImageDimensions();
}

function zoomOutEvent(e) {
    if(imgDetectFlag){
        imgOriH = $("img")[0].height;
        imgOriW = $("img")[0].width;
        imgDetectFlag = false;
    }
    if($('img').height() > $(".resize-div")[0].offsetHeight && $('img').width() > $(".resize-div")[0].offsetWidth){
        $("img")[0].height = $("img")[0].height * 0.9;
        updateImageDimensions();
    }else{
        swal({
            title: "有點疑問",
            text: "縮這麼小看得到嗎？",
            icon: "info",
        });
    }
}

function updateImageDimensions() {
    var imgW = $('.main-image').outerWidth();
    var imgH = $('.main-image').outerHeight();
    $('#image-dimensions').text(`Image: ${imgW} x ${imgH}`);
}

function backToGameEvent(e) {
    var rankContainer = document.getElementById('rank-container');
    var anifaceContainer = document.getElementById('aniface');
    rankContainer.style.display = 'none';
    anifaceContainer.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('submit').addEventListener('click', clickEvent);
  document.getElementById('add').addEventListener('click', addEvent);
  document.getElementById('del').addEventListener('click', deleteEvent);
  document.getElementById('rank').addEventListener('click', rankEvent);
  document.getElementById('details').addEventListener('click', detailsEvent);
  document.getElementById('zoom-in').addEventListener('click', zoomInEvent);
  document.getElementById('zoom-out').addEventListener('click', zoomOutEvent);
  document.getElementById('back-to-game').addEventListener('click', backToGameEvent);
});

window.addEventListener('resize', () => {
    fixTop = $('.main-image')[0].offsetTop;
    fixLeft = $('.main-image')[0].offsetLeft;

    // Reposition existing frames
    $(".resize-div").each(function() {
        var top = this.offsetTop - fixTop;
        var left = this.offsetLeft - fixLeft;
        var boxHW = this.offsetWidth;
        var imgH = $('.main-image').outerHeight();
        var imgW = $('.main-image').outerWidth();

        if (top < 0) {
            $(this).css({ "top": fixTop });
        } else if (top + boxHW > imgH) {
            $(this).css({ "top": imgH - boxHW + fixTop });
        }

        if (left < 0) {
            $(this).css({ "left": fixLeft });
        } else if (left + boxHW > imgW) {
            $(this).css({ "left": imgW - boxHW + fixLeft });
        }
    });
});
