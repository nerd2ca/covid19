var series = []
var graph
m.request({
    url: 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv',
    extract: function(xhr) {
        var percountry = {}
        var maxmin = 0
        xhr.responseText.split("\n").map(function(text, linenumber) {
            var values = text.replace(/(\".*?\")/g, function(quoted) { return quoted.replace(/,/g, ".")}).split(",")
            if (linenumber == 0) {
                // ... header
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
            while (tot.length>8 && tot[8]<100)
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
            while (tot.length > 0 && tot[0] == 0) {
                offset++
                tot.splice(0, 1)
            }
            if (tot.length + offset > 40)
                tot.splice(40-offset)
            series.push({
                name: country,
                color: palette.color(),
                data: tot.map(function(n, i) {
                    return {x: i+offset, y: n}
                }),
                scale: d3.scale.log().domain([30, 100000]).nice(),
            })
        })
        return {series: series}
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
        formatter: function(series, x, y) {
            var dur = `${series.data[0].x>0?'~':''}${Math.abs(x-8)} day${Math.abs(x-8)==1?'':'s'}`
            if (series.data.length<=8 || series.data[8].y<100) dur=""
            return `${series.name}, ${dur} ${x<8 ? 'before' : 'after'} reaching 100: ${y.toFixed()}`
        },
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
    graph.render()
})
document.getElementById("legend").addEventListener("mousemove", function(e) { legendhover(e.toElement.series || e.toElement.parentElement.series, true) })
document.getElementById("legend").addEventListener("mouseout", function(e) { legendhover(null, false) })
window.addEventListener("resize", function(e) { if (graph) { graph.setSize(); graph.render() } })
function legendhover(target, keep) {
    if (keep && !target)
        return
    for (var i=0; i<series.length; i++) {
        if (!series[i].colorInitial)
            series[i].colorInitial = series[i].color
        if (!target || series[i].name === target.name)
            series[i].color = series[i].colorInitial
        else
            series[i].color = series[i].colorInitial + '22'
    }
    graph.render()
}
