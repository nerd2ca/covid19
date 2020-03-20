m.request({
    url: 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv',
    extract: function(xhr) {
        var percountry = {}
        xhr.responseText.split("\n").map(function(text, linenumber) {
            var values = text.replace(/(\".*?\")/g, function(quoted) { return quoted.replace(/,/g, ".")}).split(",")
            if (linenumber == 0) {
                // ... header
            } else {
                var tot = percountry[values[1]] || []
                for (var i = 4; i<values.length; i++) {
                    tot[i-4] = (tot[i-4] || 0) + parseInt(values[i])
                }
                percountry[values[1].replace(/"/g, "")] = tot
            }
        })
        var aligned = []
        var labels = ['day']
        Object.keys(percountry).map(function(country) {
            var tot = percountry[country]
            while (tot.length>0 && tot[0]<100)
                tot.splice(0, 1)
            if (tot.length == 0)
                return
            for (var i=0; i<tot.length || i<aligned.length; i++) {
                aligned[i] = aligned[i] || [aligned.length]
                while (aligned[i].length < aligned[0].length-1)
                    aligned[i].push(null)
                aligned[i].push(tot[i] || null)
            }
            labels.push(country)
        })
        console.log(aligned)
        return {series: aligned}
    },
}).then(function(resp) {
    g = new Rickshaw.Graph({
        element: document.getElementById("graphdiv"),
        series: resp.series,
    })
})
