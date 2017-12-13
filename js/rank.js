$.ajaxSettings.async = false;

var url = 'https://spreadsheets.google.com/feeds/list/1uiIZom7r_zlfr-ZwQDJx4IBta-TkQqzI2b3MfDdclTY/owvgydt/public/full?alt=json';
var json = $.get(url);
var obj = JSON.parse(json.responseText);

var result = {};
var list = obj['feed']['entry'];

/* Special Thanks Paul */
for (var i = 0; i < list.length; i++) {
    var imgV = list[i]["gsx\$storedatabasename"]["\$t"].trim();
    var userV = list[i]["gsx\$storedatabaseuser"]["\$t"].trim();
    var ary = result[userV];
    if (!ary) {
        ary = [];
        ary.push(imgV);
        result[userV] = ary;
    } else { //沒有存在的話
        if (ary.indexOf(imgV) == -1) {
            ary.push(imgV);
        }
    }
}

$.each(result, function(key, value) {
    result[key] = value.length;
});

var sortable = [];
for (var vehicle in result) {
    sortable.push([vehicle, result[vehicle]]);
}
sortable.sort(function(a, b) {
    return b[1] - a[1];
});

var str = '';
for (var i = 0; i<sortable.length; i++){
    var key = sortable[i][0]; // count
    var value = sortable[i][1]; // name
    str += '<tr><td>' + key + '</td><td>' + value + '</td></tr>';
}
$('tbody').html(str);
