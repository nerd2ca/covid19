var series = []
var graph
m.request({
    url: 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv',
    extract: function(xhr) {
        var hdr
        var percountry = {}
        var maxmin = 0
        xhr.responseText.split("\n").map(function(text, linenumber) {
            var values = text.replace(/(\".*?\")/g, function(quoted) { return quoted.replace(/,/g, ".")}).split(",")
            if (linenumber == 0) {
                hdr = values
            } else {
                var tot = percountry[values[1]] || []
                for (var i = 4; i<values.length; i++) {
                    tot[i-4] = (tot[i-4] || 0) + parseInt(values[i])
                }
                if (tot[0] > maxmin)
                    maxmin = tot[0]
                percountry[values[1].replace(/"/g, "").replace(/(.*)\. (.*)/, "$2 $1")] = tot
            }
        })
        var palette = new Rickshaw.Color.Palette()
        series = []
        Object.keys(percountry).sort(function(a, b){
            a = percountry[a]
            b = percountry[b]
            return a[a.length-1] - b[b.length-1]
        }).map(function(country) {
            var tot = percountry[country]
            while (tot.length>8 && tot[8]<100 && tot[tot.length-1]>=100)
                tot.splice(0, 1)
            var offset = 0
            if (tot.length > 7 && tot[7] > 100) {
                for (var i=0; i<series.length; i++) {
                    if (series[i].data[0].x > 0)
                        continue
                    for (var j=0; j<series[i].data.length-1; j++) {
                        if (offset > 0 && j >= offset) {
                            break
                        }
                        if (series[i].data[j].y < tot[0] && series[i].data[j+1].y >= tot[0]) {
                            offset = j
                            break
                        }
                    }
                }
            }
            if (tot[tot.length-1] < 100)
                while (tot.length > 0 && tot[0] < 10)
                    tot.splice(0, 1)
            while (tot.length > 0 && tot[0] == 0) {
                offset++
                tot.splice(0, 1)
            }
            var datecoloffset = hdr.length - tot.length
            if (tot.length < 1)
                return
            var data = tot.map(function(n, i) {
                return {x: i+offset, y: n}
            })
            var lastExp = exponentAt(data, data.length-1)
            series.push({
                name: country+' <span class="float-right">'+tot[tot.length-1]+(lastExp===NaN?'':' <span class="font-weight-light">@</span> '+lastExp.toFixed(2)+'</span>'),
                color: palette.color(),
                data: data,
                scale: d3.scale.log().domain([30, 100000]).nice(),
                xdate: function(x) {
                    return new Date(hdr[x - offset + datecoloffset]).toDateString()
                },
                dataOffset: offset,
                xFormatter: function(d) {
                    return `C+${d-8}`
                },
                formatter: function(series, x, y) {
                    var name = series.name.replace(/ <.*/, '')
                    if (series.data[series.data.length-1].y<100)
                        return `${name}: ${y.toFixed()}`
                    var dur = `${series.data[0].x>0?'maybe ':''}${Math.abs(x-8)} day${Math.abs(x-8)==1?'':'s'}`
                    if (series.data.length<=8 || series.data[8].y<100) dur=""
                    var exp = exponentAt(series.data, x - series.dataOffset)
                    if (exp === NaN)
                        exp = ''
                    else
                        exp = ', exponent = '+exp.toFixed(2)
                    return `${name}, ${series.xdate(x)} (${dur} ${x<8 ? 'before' : 'after'} C): ${y.toFixed()}${exp}`
                },
            })
        })
        return {
            series: series.sort(function(a, b) {
                var alen = a.data[a.data.length-1].y.toFixed(0).length
                var blen = b.data[b.data.length-1].y.toFixed(0).length
                if (alen != blen)
                    return alen - blen
                a = exponentAt(a.data, a.data.length - 1 - a.dataOffset)
                b = exponentAt(b.data, b.data.length - 1 - b.dataOffset)
                if (a === NaN || b === NaN)
                    return 0
                return a-b
            }),
        }
    },
}).then(function(resp) {
    series = resp.series
    graph = new Rickshaw.Graph({
        element: document.getElementById("graph"),
        renderer: "line",
        series: resp.series,
    })
    var hoverDetail = new Rickshaw.Graph.HoverDetail({
        graph: graph,
        formatter: function(series,x,y) { return series.formatter(series,x,y) },
        xFormatter: function(series,x,y) { return series.xFormatter(series,x,y) },
    })
    var legend = new Rickshaw.Graph.Legend({
        graph: graph,
        element: document.getElementById("legend"),
    })
    new Rickshaw.Graph.Axis.Y.Scaled({
        element: document.getElementById('axis0'),
        graph: graph,
        orientation: 'left',
        scale: resp.series[0].scale,
    });
    new Rickshaw.Graph.Behavior.Series.Highlight({
        graph: graph,
        legend: legend,
        disabledColor: function() { return 'rgba(0, 0, 0, 0.1)' }
    });
    graph.render()
})
window.addEventListener("resize", function(e) { if (graph) { graph.setSize(); graph.render() } })

function exponentAt(data, idx) {
    if (idx < 2 || idx > data.length)
        return NaN
    var n = data[idx-2].y
    var nprime = data[idx].y
    if (n > 0 && nprime > 0)
        return (Math.log(nprime) - Math.log(n))/2
    else
        return NaN
}
