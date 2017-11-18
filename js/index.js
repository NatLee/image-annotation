var ary = [];
var fixTop = 105;
var fixLeft = 8;
var num = Math.floor((Math.random() * 20) + 1);
$("img").attr("src", "./img/" + num + ".png");


function clickEvent(e) {
  ary = [];

  var googleForm = 'https://docs.google.com/forms/d/e/1FAIpQLScGl6BSyRiCaIVt67Dkzlr7okTQQ3Wnt7VBpivvVG5hbly8tA/formResponse';
  var entryImgName = '?entry.758844231=';
  var entryBoxHeightOffset = '?entry.1881696409=';
  var entryBoxLeftOffset = '?entry.669378490=';
  var entryBoxSize = '?entry.676533522=';
  var entryUser = '?entry.1877828300=';

  var boxes = $(".resizeDiv");
  for(var i=0;i<boxes.length;i++){
    var boxTop = boxes[i]["offsetTop"]-fixTop;
    var boxLeft = boxes[i]["offsetLeft"]-fixLeft;
    var boxSize = boxes[i]["offsetWidth"];
    var obj = {
      top : boxTop,
      left : boxLeft,
      size : boxSize
    };
    ary.push(obj);
    entryImgName += 'YEE';
    entryBoxHeightOffset += boxTop;
    entryBoxLeftOffset += boxLeft;
    entryBoxSize += boxSize;
    entryUser += 'USER'

    googleForm = googleForm + entryImgName + entryBoxHeightOffset + entryBoxLeftOffset + entryBoxSize + entryUser;
    $.get(googleForm, '');

  }
  console.log(ary);

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
  var top = this.offsetTop-fixTop;
  var left = this.offsetLeft-fixLeft;
  var boxHW = this.offsetWidth;
  var imgH = $('img').height();
  var imgW = $('img').width();
  //console.log(imgH,imgW)
  if(top<0){
    $(this).css({"top":fixTop});
  }
  else if(top+boxHW>imgH){
    $(this).css({"top":imgH-boxHW+fixTop});
  }
  if(left<0){
    $(this).css({"left":fixLeft});
  }
  else if(left+boxHW>imgW){
    $(this).css({"left":imgW-boxHW+fixLeft});
  }
}

function deleteEvent(e) {
  var len = $(".resizeDiv").length;
  if(len==1){
    return;
  }
  $(".resizeDiv")[len-1].outerHTML='';
  ary.pop()
}
