var ary = [];
var fixTop = 105;
var fixLeft = 8;
var num = Math.floor((Math.random() * 20) + 1);
$("img").attr("src", "./img/" + num + ".png");


function clickEvent(e) {
  ary = [];
  var boxes = $(".resizeDiv");
  for(var i=0;i<boxes.length;i++){
    var obj = {
      top: boxes[i]["offsetTop"]-fixTop,
      left: boxes[i]["offsetLeft"]-fixLeft,
      width: boxes[i]["offsetWidth"]
    };
    ary.push(obj);
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

function submitEvent(e) {
    console.log(ary)
    $.get('https://docs.google.com/forms/d/e/1FAIpQLScGl6BSyRiCaIVt67Dkzlr7okTQQ3Wnt7VBpivvVG5hbly8tA/formResponse?entry.758844231=' + ary + '&entry.1877828300=' + 'GANBARUBY',"")
  //$.get('https://docs.google.com/forms/d/e/1FAIpQLScGl6BSyRiCaIVt67Dkzlr7okTQQ3Wnt7VBpivvVG5hbly8tA/formResponse?entry.758844231=' + String(ary) + '&entry.1877828300=' + 'GANBARUBY',"")
}
