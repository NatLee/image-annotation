var ary = [];
let imgURL;
let imgName;

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
        drag: function(e, ui) {
            constrainBoundingBox($(this));
            updateBoxData($(this));
        },
        stop: function(e, ui) {
            constrainBoundingBox($(this));
            updateBoxData($(this));
        }
    }).resizable({
        resize: function(e, ui) {
            constrainBoundingBox($(this));
            updateBoxData($(this));
        },
        stop: function(e, ui) {
            constrainBoundingBox($(this));
            updateBoxData($(this));
        }
    });
}

function constrainBoundingBox(box) {
    var img = $('.main-image');
    var imageWidth = img[0].naturalWidth;
    var imageHeight = img[0].naturalHeight;
    var displayCoords = {
        x: box.position().left,
        y: box.position().top,
        width: box.width(),
        height: box.height()
    };
    var originalCoords = displayToOriginal(displayCoords);
    originalCoords.x = Math.max(0, Math.min(originalCoords.x, imageWidth - originalCoords.width));
    originalCoords.y = Math.max(0, Math.min(originalCoords.y, imageHeight - originalCoords.height));
    originalCoords.width = Math.min(originalCoords.width, imageWidth - originalCoords.x);
    originalCoords.height = Math.min(originalCoords.height, imageHeight - originalCoords.y);
    var newDisplayCoords = originalToDisplay(originalCoords);
    box.css({
        left: newDisplayCoords.x + 'px',
        top: newDisplayCoords.y + 'px',
        width: newDisplayCoords.width + 'px',
        height: newDisplayCoords.height + 'px'
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
    // Convert display coordinates to original image coordinates for storage.
    var originalCoords = displayToOriginal(displayCoords);

    var index = boxElement.index('.resize-div');
    if (index > -1) {
        // Store the original coordinates in the main array.
        ary[index] = {
            left: originalCoords.x,
            top: originalCoords.y,
            width: originalCoords.width,
            height: originalCoords.height,
        };
    }

    // Update the info display for this specific box
    updateBoxInfo(boxElement, originalCoords);
}

function updateBoxInfo(boxElement, coords) {
    var infoText = `(${parseInt(coords.x)}, ${parseInt(coords.y)}) - ${parseInt(coords.width)}×${parseInt(coords.height)}`;
    boxElement.find('.box-info-display').text(infoText);
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
        width: size,
        height: size
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
        width: originalBox.width,
        height: originalBox.height
    });

    var newBox = $('<div class="resize-div"></div>').css({
        'left': displayBox.x + 'px',
        'top': displayBox.y + 'px',
        'width': displayBox.width + 'px',
        'height': displayBox.height + 'px'
    });

    // Add the info display to the box
    newBox.append('<div class="box-info-display"></div>');

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

function updateImageDimensions() {
    var img = $('.main-image');
    var originalWidth = img[0].naturalWidth;
    var originalHeight = img[0].naturalHeight;
    var displayWidth = img.width();
    var displayHeight = img.height();
    var scale = (displayWidth / originalWidth) * 100;

    $('#image-dimensions').html(`
        Original: ${originalWidth}×${originalHeight} |
        Display: ${Math.round(displayWidth)}×${Math.round(displayHeight)} |
        Scale: ${scale.toFixed(2)}%
    `);
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
    document.getElementById('save-annotations').addEventListener('click', saveAnnotationSession);
    document.getElementById('export-all').addEventListener('click', exportAllAnnotations);
    document.getElementById('clear-all').addEventListener('click', clearAllData);
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
                width: originalBox.width,
                height: originalBox.height
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
    updateImageDimensions();
    redrawBoxes();
});

function validateCoordinates() {
    var container = $('.image-container');
    var overlay = container.find('.grid-overlay');
    if (overlay.length) {
        overlay.remove();
        return;
    }

    overlay = $('<div class="grid-overlay"></div>').css({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
    });

    for (var i = 0; i < 10; i++) {
        var x = (i * 10) + '%';
        var y = (i * 10) + '%';

        overlay.append($('<div></div>').css({ position: 'absolute', top: 0, left: x, width: '1px', height: '100%', backgroundColor: 'rgba(255, 0, 0, 0.5)' }));
        overlay.append($('<div></div>').css({ position: 'absolute', top: y, left: 0, width: '100%', height: '1px', backgroundColor: 'rgba(255, 0, 0, 0.5)' }));
    }

    container.append(overlay);
}

// Keydown event listener for 'd' key to toggle validation grid
document.addEventListener('keydown', (e) => {
    if (e.key === 'd') {
        validateCoordinates();
    }
});

function exportAnnotations() {
    const img = $('.main-image');
    const originalImageWidth = img[0].naturalWidth;
    const originalImageHeight = img[0].naturalHeight;
    const displayWidth = img.width();
    const displayHeight = img.height();
    const scaleFactor = displayWidth / originalImageWidth;
    const userName = document.getElementById("userName").value || 'anonymous';

    const annotationData = {
        image_url: imgURL,
        original_size: {
            width: originalImageWidth,
            height: originalImageHeight
        },
        display_size: {
            width: Math.round(displayWidth),
            height: Math.round(displayHeight)
        },
        scale_factor: scaleFactor,
        annotator: userName,
        timestamp: new Date().toISOString(),
        bounding_boxes: ary.map((box, index) => {
            const displayCoords = originalToDisplay({
                x: box.left,
                y: box.top,
                width: box.width,
                height: box.height
            });
            return {
                id: index + 1,
                original_coords: {
                    x: box.left,
                    y: box.top,
                    width: box.width,
                    height: box.height
                },
                display_coords: {
                    x: displayCoords.x,
                    y: displayCoords.y,
                    width: displayCoords.width,
                    height: displayCoords.height
                }
            };
        })
    };
    localStorage.setItem('annotations_' + Date.now(), JSON.stringify(annotationData));
    downloadJSON(annotationData, `annotations_${Date.now()}.json`);
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Save current annotation session to localStorage
function saveAnnotationSession() {
  // Get existing data from localStorage
  let existingData = JSON.parse(localStorage.getItem('annotation_data')) || {
    annotation_records: [],
    total_images: 0,
    total_annotations: 0,
    last_updated: null
  };

  const img = $('.main-image');
  const originalImageWidth = img[0].naturalWidth;
  const originalImageHeight = img[0].naturalHeight;
  const displayWidth = img.width();
  const displayHeight = img.height();
  const scaleFactor = displayWidth / originalImageWidth;
  const userName = document.getElementById("userName").value || 'anonymous';

  // Create new session record
  const newSession = {
    session_id: `session_${Date.now()}`,
    image_url: imgURL,
    original_size: {
      width: originalImageWidth,
      height: originalImageHeight
    },
    display_size: {
      width: displayWidth,
      height: displayHeight
    },
    scale_factor: scaleFactor,
    annotator: userName,
    timestamp: new Date().toISOString(),
    // The 'ary' array already contains coordinates in the original image's dimensions,
    // so no conversion is needed here.
    bounding_boxes: ary.map((box, index) => ({
      id: index + 1,
      x: box.left,
      y: box.top,
      width: box.width,
      height: box.height,
      label: 'anime_face'
    }))
  };

  // Add to existing data
  existingData.annotation_records.push(newSession);
  existingData.total_images = existingData.annotation_records.length;
  existingData.total_annotations = existingData.annotation_records.reduce(
    (total, record) => total + record.bounding_boxes.length, 0
  );
  existingData.last_updated = new Date().toISOString();

  // Save back to localStorage
  localStorage.setItem('annotation_data', JSON.stringify(existingData));

  // Show success message
  alert(`Annotation saved! Total: ${existingData.total_images} images, ${existingData.total_annotations} annotations`);
}

// Export all annotation records from localStorage
function exportAllAnnotations() {
  // Get all data from localStorage
  const allData = JSON.parse(localStorage.getItem('annotation_data'));

  if (!allData || allData.annotation_records.length === 0) {
    alert('No annotation data found to export!');
    return;
  }

  // Create export data with metadata
  const exportData = {
    export_info: {
      export_date: new Date().toISOString(),
      total_images: allData.total_images,
      total_annotations: allData.total_annotations,
      data_range: {
        first_annotation: allData.annotation_records[0]?.timestamp,
        last_annotation: allData.annotation_records[allData.annotation_records.length - 1]?.timestamp
      }
    },
    annotation_records: allData.annotation_records
  };

  // Download as JSON file
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `all_annotations_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert(`Exported ${allData.total_images} images with ${allData.total_annotations} annotations!`);
}

// Clear all stored data (with confirmation)
function clearAllData() {
  if (confirm('Are you sure you want to delete all annotation data? This cannot be undone.')) {
    localStorage.removeItem('annotation_data');
    alert('All annotation data cleared!');
  }
}
