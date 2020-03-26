var shifty = false
var recoverDays = 14
var graph, xaxis, loaded

window.addEventListener("resize", function(e) {
    if (!graph)
        return
    graph.setSize()
    xaxis.setSize()
    graph.render()
})

// Reload source data every hour, update chart if it has changed.
window.setInterval(getData, 3600000)

function getData() { return m.request({
    url: 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv',
    extract: function(xhr) {
        if (loaded && loaded !== xhr.responseText) {
            // Updating is awkward, but reloading is easy.
            document.location.reload()
            return
        }
        loaded = xhr.responseText
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
                    if (!values[i])
                        values[i] = i>4 ? values[i-1] : '0'
                    tot[i-4] = (tot[i-4] || 0) + parseInt(values[i])
                }
                if (tot[0] > maxmin)
                    maxmin = tot[0]
                percountry[(values[1] || '').replace(/"/g, "").replace(/(.*)\. (.*)/, "$2 $1")] = tot
            }
        })
        // Translate cumulative reported cases to estimate of active
        // cases by subtracting cases that existed 14 days ago.
        Object.keys(percountry).map(function(c) {
            for (var i=percountry[c].length-1; i>=recoverDays; i--) {
                percountry[c][i] -= percountry[c][i-recoverDays]
                if (percountry[c][i] < 1)
                    percountry[c][i] = 1 // Avoid dividing by zero when using log scale
            }
            percountry[c].splice(0, recoverDays)
        })
        var max = 0
        Object.values(percountry).map(function(tot){
            for (var i=0; i<tot.length; i++)
                if (max<tot[i])
                    max=tot[i]
        })
        console.log(max)
        var series = []
        Object.keys(percountry).sort(function(a, b){
            a = percountry[a]
            b = percountry[b]
            return a[a.length-1] - b[b.length-1]
        }).map(function(country) {
            var tot = percountry[country]
            if (tot[tot.length-1]>=100 && shifty)
                while (tot.length>8 && tot[8]<100)
                    // Shift data to the left until the 100-cases
                    // threshold happens before x=8
                    tot.splice(0, 1)
            var offset = 0
            if (tot.length > 7 && tot[7] > 100 && shifty) {
                // Shift data to the right until the first point lines
                // up with another (non-shifted) country
                Object.keys(percountry).map(function(c) {
                    if (c == country || percountry[c].length < 8 || percountry[c][7] > 100 || percountry[c][percountry[c].length-1] < 100)
                        return
                    var joff
                    for (joff=0; joff<percountry[c].length-8 && percountry[c][joff+8]<100; joff++) {}
                    for (var j=0; j<percountry[c].length-1; j++) {
                        if (offset > 0 && j >= offset) {
                            break
                        }
                        if (percountry[c][j] < tot[0] && percountry[c][j+1] >= tot[0]) {
                            offset = j-joff
                            break
                        }
                    }
                })
            }
            if (tot[tot.length-1] < 100 && shifty)
                while (tot.length > 0 && tot[0] < 10)
                    tot.splice(0, 1)
            while (tot.length > 0 && tot[0] == 0 && shifty) {
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
                name: country+' <span class="float-right">'+tot[tot.length-1]+(lastExp===NaN?'':' <span class="font-weight-light">@</span> '+Math.exp(lastExp).toFixed(2)+'&times;</span>'),
                data: data,
                scale: d3.scale.log().domain([8, max]),
                xdate: function(x) {
                    return new Date(hdr[x - offset + datecoloffset]).toDateString()
                },
                dataOffset: offset,
                xFormatter: function(x) {
                    if (shifty)
                        return `C+${x-8}`
                    var t = new Date(hdr[x - offset + datecoloffset])
                    return t.toDateString().replace(' 2020', '').replace(/^... (...) 0?([0-9])/, '$1 $2')
                },
                formatter: function(series, x, y) {
                    var name = series.name.replace(/ <.*/, '')
                    var ret = name
                    if (shifty) {
                        ret += ', '+series.xdate(x)
                        if (series.data[series.data.length-1].y >= 100) {
                            var dur = `${series.data[0].x>0?'maybe ':''}${Math.abs(x-8)} day${Math.abs(x-8)==1?'':'s'} `
                            if (series.data.length<=8 || series.data[8].y<100) dur=""
                            ret += ' ('+dur+(x<8 ? 'before' : 'after')+' C)'
                        }
                    }
                    ret += ': '+y.toFixed()
                    var exp = exponentAt(series.data, x - series.dataOffset)
                    if (!isNaN(exp))
                        ret += ', daily = '+Math.exp(exp).toFixed(2)+'&times;'
                    return ret
                },
            })
        })
        series = series.sort(function(a, b) {
            var alen = a.data[a.data.length-1].y.toFixed(0).length
            var blen = b.data[b.data.length-1].y.toFixed(0).length
            if (alen != blen)
                return alen - blen
            a = exponentAt(a.data, a.data.length - 1 - a.dataOffset)
            b = exponentAt(b.data, b.data.length - 1 - b.dataOffset)
            if (a === NaN || b === NaN)
                return 0
            return a-b
        })
        var palette = new Rickshaw.Color.Palette({scheme: 'spectrum2001', interpolatedStopCount: Math.ceil(series.length/19)})
        for (var i=series.length-1; i>=0; i--)
            series[i].color = palette.color()
        return {
            series: series,
        }
    },
})}

getData().then(function(resp) {
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
        element: document.getElementById('axisy'),
        graph: graph,
        orientation: 'left',
        scale: resp.series[0].scale,
    });
    xaxis = new Rickshaw.Graph.Axis.X({
        element: document.getElementById('axisx'),
        graph: graph,
        orientation: 'bottom',
        ticks: 7,
        tickFormat: resp.series[0].xFormatter,
    });
    new Rickshaw.Graph.Behavior.Series.Highlight({
        graph: graph,
        legend: legend,
        disabledColor: function() { return 'rgba(0, 0, 0, 0.1)' }
    });
    graph.render()
})

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
