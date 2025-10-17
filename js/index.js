var ary = [];
let imgURL;
let imgName;
let zoomLevel = 1.0;
var fixTop = 0;
var fixLeft = 0;

// Use the waifu.im API to fetch a random image
fetch('https://api.waifu.im/search')
    .then(response => response.json())
    .then(data => {
        imgURL = data.images[0].url;
        $(".main-image").attr("src", imgURL).on('load', function() {
            calculateViewport();
            updateImageDimensions();
            redrawBoxes();
            addEvent(null, true); // Add default box
        });
        var list = imgURL.split('/');
        imgName = list[list.length - 1];
    });

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
            var googleForm = 'https://docs.google.com/forms/d/e/1FAIpQLScGl6BSyRiCaIVt67Dkzlr7okTQQ3Wnt7VBpivvVG5hbly8tA/formResponse?';
            var entryImgName = 'entry.758844231=';
            var entryBoxHeightOffset = 'entry.1881696409=';
            var entryBoxLeftOffset = 'entry.669378490=';
            var entryBoxSize = 'entry.676533522=';
            var entryUser = 'entry.1877828300=';
            userName = document.getElementById("userName").value;
            var entryUserSend = entryUser + userName;
            if (!ary.length) { // No boxes
                $.get(googleForm + entryImgName + imgName + '&' + entryBoxHeightOffset + '-1&' + entryBoxLeftOffset + '-1&' + entryBoxSize + '-1&' + entryUserSend);
            } else {
                for (var i = 0; i < ary.length; i++) {
                    var box = ary[i];
                    var boxTop = parseInt(box.top);
                    var boxLeft = parseInt(box.left);
                    var boxSize = parseInt(box.size);

                    var entryImgNameSend = entryImgName + imgName;
                    var entryBoxHeightOffsetSend = entryBoxHeightOffset + boxTop;
                    var entryBoxLeftOffsetSend = entryBoxLeftOffset + boxLeft;
                    var entryBoxSizeSend = entryBoxSize + boxSize;
                    var googleFormSend = googleForm + entryImgNameSend + '&' + entryBoxHeightOffsetSend + '&' + entryBoxLeftOffsetSend + '&' + entryBoxSizeSend + '&' + entryUserSend;
                    $.get(googleFormSend);
                }
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

function initBox(box) {
    box.on('click', function(e) {
        e.stopPropagation();
        $('.resize-div').removeClass('selected');
        $(this).addClass('selected');
        updateBoxData($(this));
    });

    box.draggable({
        containment: "parent",
        drag: function(e, ui) {
            var changeLeft = ui.position.left - ui.originalPosition.left;
            var newLeft = ui.originalPosition.left + changeLeft / zoomLevel;
            var changeTop = ui.position.top - ui.originalPosition.top;
            var newTop = ui.originalPosition.top + changeTop / zoomLevel;
            ui.position.left = newLeft;
            ui.position.top = newTop;
            updateBoxData($(this));
        },
        stop: function(e, ui) {
            updateBoxData($(this));
        }
    }).resizable({
        aspectRatio: 1 / 1,
        containment: "parent",
        resize: function(e, ui) {
            var changeWidth = ui.size.width - ui.originalSize.width;
            var newWidth = ui.originalSize.width + changeWidth / zoomLevel;
            var changeHeight = ui.size.height - ui.originalSize.height;
            var newHeight = ui.originalSize.height + changeHeight / zoomLevel;
            ui.size.width = newWidth;
            ui.size.height = newHeight;
            updateBoxData($(this));
        },
        stop: function(e, ui) {
            updateBoxData($(this));
        }
    });
}

$(function() {
    window.initBox = initBox;
});

function updateBoxData(boxElement) {
    var position = boxElement.position();
    var displayCoords = {
        x: position.left,
        y: position.top,
        width: boxElement.width(),
        height: boxElement.height()
    };
    var originalCoords = displayToOriginal(displayCoords);

    var index = boxElement.index('.resize-div');
    if (index > -1) {
        ary[index] = {
            left: originalCoords.x,
            top: originalCoords.y,
            size: originalCoords.width
        };
    }

    if (boxElement.hasClass('selected')) {
        updateBoxInfo(originalCoords);
    }
}

function updateBoxInfo(coords) {
    var info = `X: ${parseInt(coords.x)}, Y: ${parseInt(coords.y)}, Size: ${parseInt(coords.width)}`;
    $('#box-info').text(info);
}

function addEvent(e, isDefault = false) {
    var img = $('.main-image');
    var originalWidth = img[0].naturalWidth;
    var originalHeight = img[0].naturalHeight;
    var size = Math.min(originalWidth, originalHeight) * 0.25; // Default size: 25% of smaller dimension
    var left = (originalWidth - size) / 2;
    var top = (originalHeight - size) / 2;

    var originalBox = {
        left: left,
        top: top,
        size: size
    };

    if (!isDefault) {
        // For new boxes added by user, place them slightly offset from the last one
        if (ary.length > 0) {
            var lastBox = ary[ary.length - 1];
            originalBox.left = lastBox.left + 20;
            originalBox.top = lastBox.top + 20;
        }
    }

    var displayBox = originalToDisplay({
        x: originalBox.left,
        y: originalBox.top,
        width: originalBox.size,
        height: originalBox.size
    });

    var newBox = $('<div class="resize-div"></div>').css({
        'left': displayBox.x + 'px',
        'top': displayBox.y + 'px',
        'width': displayBox.width + 'px',
        'height': displayBox.height + 'px'
    });

    $('.resize-div').removeClass('selected');
    newBox.addClass('selected');

    $(".image-container").append(newBox);
    ary.push(originalBox); // Add placeholder
    initBox(newBox);
    updateBoxData(newBox); // Calculate and store correct initial data
}


function deleteEvent(e) {
    var boxes = $(".resize-div");
    if (boxes.length === 0) {
        return;
    }

    var lastBox = boxes.last();
    if (lastBox.hasClass('selected')) {
        $('#box-info').text('');
    }
    lastBox.remove();
    ary.pop();
}

function rankEvent(e) {
    updateRank();
    document.getElementById('aniface').classList.remove('active');
    document.getElementById('rank-container').classList.add('active');
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

function applyZoom() {
    $('.image-container').css({
        'transform': `scale(${zoomLevel})`,
        'transform-origin': 'top left'
    });
}

function zoomInEvent(e) {
    zoomLevel *= 1.1;
    applyZoom();
}

function zoomOutEvent(e) {
    zoomLevel *= 0.9;
    applyZoom();
}

function updateImageDimensions() {
    var imgW = $('.main-image').outerWidth();
    var imgH = $('.main-image').outerHeight();
    $('#image-dimensions').text(`Image: ${imgW} x ${imgH}`);
}

function backToGameEvent(e) {
    document.getElementById('rank-container').classList.remove('active');
    document.getElementById('aniface').classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('aniface').classList.add('active');
    document.getElementById('submit').addEventListener('click', clickEvent);
    document.getElementById('add').addEventListener('click', addEvent);
    document.getElementById('del').addEventListener('click', deleteEvent);
    document.getElementById('rank').addEventListener('click', rankEvent);
    document.getElementById('details').addEventListener('click', detailsEvent);
    document.getElementById('zoom-in').addEventListener('click', zoomInEvent);
    document.getElementById('zoom-out').addEventListener('click', zoomOutEvent);
    document.getElementById('back-to-game').addEventListener('click', backToGameEvent);
});

function calculateViewport() {
    var toolbarHeight = document.getElementById('toolbar').offsetHeight;
    var availableHeight = window.innerHeight - toolbarHeight;
    var availableWidth = window.innerWidth;

    var img = $('.main-image');
    var imgAspectRatio = img[0].naturalWidth / img[0].naturalHeight;

    var displayWidth = availableWidth;
    var displayHeight = displayWidth / imgAspectRatio;

    if (displayHeight > availableHeight) {
        displayHeight = availableHeight;
        displayWidth = displayHeight * imgAspectRatio;
    }

    var container = $('.image-container');
    container.css({
        'width': displayWidth + 'px',
        'height': displayHeight + 'px'
    });
    img.css({
        'width': '100%',
        'height': '100%'
    });

    var offset = container.offset();
    fixTop = offset.top;
    fixLeft = offset.left;

    zoomLevel = 1.0;
    applyZoom();
}

function originalToDisplay(originalCoords) {
    var img = $('.main-image');
    if (!img[0] || !img[0].naturalWidth) return { x: 0, y: 0, width: 0, height: 0 };

    var container = $('.image-container');
    var scale = container.width() / img[0].naturalWidth;

    return {
        x: originalCoords.x * scale,
        y: originalCoords.y * scale,
        width: originalCoords.width * scale,
        height: originalCoords.height * scale
    };
}

function displayToOriginal(displayCoords) {
    var img = $('.main-image');
    if (!img[0] || !img[0].naturalWidth) return { x: 0, y: 0, width: 0, height: 0 };

    var container = $('.image-container');
    if (container.width() === 0) return { x: 0, y: 0, width: 0, height: 0 };

    var scale = img[0].naturalWidth / container.width();

    return {
        x: displayCoords.x * scale,
        y: displayCoords.y * scale,
        width: displayCoords.width * scale,
        height: displayCoords.height * scale
    };
}


function redrawBoxes() {
    $(".resize-div").each(function(index) {
        var originalBox = ary[index];
        if (originalBox) {
            var displayBox = originalToDisplay({
                x: originalBox.left,
                y: originalBox.top,
                width: originalBox.size,
                height: originalBox.size
            });
            $(this).css({
                'left': displayBox.x + 'px',
                'top': displayBox.y + 'px',
                'width': displayBox.width + 'px',
                'height': displayBox.height + 'px'
            });
        }
    });
}

window.addEventListener('resize', () => {
    calculateViewport();
    redrawBoxes();
});
