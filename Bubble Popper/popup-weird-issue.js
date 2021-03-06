/*
document.addEventListener('DOMContentLoaded', function() {
  var titleButton = document.getElementById('titleButton');
  titleButton.addEventListener('click', function() {

    chrome.tabs.getSelected(null, function(tab) {
      document.getElementById('pageTitle').innerHTML = tab.title;
    });
  }, false);
}, false);
*/

// Verify the endpoint URI.  At this writing, only one endpoint is used for Bing
// search APIs.  In the future, regional endpoints may be available.  If you
// encounter unexpected authorization errors, double-check this host against
// the endpoint for your Bing Search instance in your Azure dashboard.
var host = 'api.cognitive.microsoft.com';
var path = '/bing/v7.0/search';

var microsoftSubscriptionKey = "c9b360263b3940079eacdbc972479a91"; // Samuel Rabinowitz trial key #1 as of 4/15/2018

var aylienConceptExtractionEndpoint = "https://api.aylien.com/api/v1/concepts";
var aylienApplicationKeyHeader = "X-AYLIEN-TextAPI-Application-Key";
var aylienApplicationIdHeader = "X-AYLIEN-TextAPI-Application-ID";
var aylienApplicationKey = "60fdcf5c8e987f18b2392384831a5ec4"; // Swathi's key
var aylienApplicationId = "35b179ce"; // Swathi's ID
var datArr = [[],[]];


document.addEventListener('DOMContentLoaded', function() {
    var frame = document.getElementById('mainFrame');

    // Political bias of articles ranges from [-1.5, +1.5] where -1.5 is very liberal, 0.0 is neutral, and +1.5 is very conservative.
    // Political bias of articles ranges from [-1.0, +1.0] where -1.0 is very liberal, 0.0 is neutral, and +1.0 is very conservative.
    var politicalBias;// = 0.12; // THIS IS FOR A SOURCE, NOT ARTICLE

    // Get the title of the article from the title of the tab
    chrome.tabs.query({'active': true, 'lastFocusedWindow': true}, function (tabs) {
        var tabTitle = tabs[0].title;
        var tabUrl = tabs[0].url;
        console.log(tabTitle);
        var trimmedTabUrl = trimUrl(tabUrl);

        // Read in the data copied from https://topbottomcenter.com/stats/ about AI-determined biases of news sources
        var rankingDataURL = "https://raw.githubusercontent.com/5happy1/bubblepopper/master/Bubble%20Popper/data/source_bias_data.csv";
        httpGetAsync(rankingDataURL, function(callback) {
            var csv = callback;
            var newsSources = $.csv.toObjects(csv);
            console.log(newsSources);

            // Find current website in supported news sources
            console.log("Trimmed tab URL: " + trimmedTabUrl);
            var knownSource = newsSources.find(function(source) {return trimUrl(source.URL) === trimmedTabUrl});
            if (typeof knownSource == "undefined") {
                // If source is not in list, display a message saying so and then exit
                document.getElementById("title").innerHTML = "We're sorry, we don't have " + trimmedTabUrl + " in our database. Try another news source.";
                console.log("Source is undefined");
                return;
            }

            // Source is in list, so save political bias
            console.log(knownSource);
            politicalBias = parseFloat(knownSource['Calculated Political Bias']);
            console.log("Source Political Bias: " + politicalBias)

            // Extract concepts for use in the Bing search using Aylien's concept extraction API
            console.log("Tab URL to use in Aylien: " + tabUrl);
            aylien_concept_extraction(tabUrl, function(callback) {
                var parsedJSON = JSON.parse(callback);
                var parsedConcepts = parsedJSON.concepts;
                console.log(parsedJSON);
                var arr;
                for (var i in parsedConcepts) {
                    var newStr = i.replace(/_/g, " ");
                    var keyConcept = newStr.replace("http://dbpedia.org/resource/", "");
                    var inside = parsedConcepts[i];
                    for (var t in inside) {
                        if (t == 'support') {
                            var num = inside[t];
                            if (keyConcept != null && typeof keyConcept != "undefined") {
                                if (!knownSource.Source.toLowerCase().includes(keyConcept.toLowerCase())) {
                                    if (tabTitle.includes(keyConcept)) {
                                        datArr.push([keyConcept, 5]);
                                    }
                                    else {
                                        datArr.push([keyConcept, num]);
                                    }
                                }
                            }
                        }
                    }
                }
                console.log(datArr.sort(compareSecondColumn));
                //.surfaceForms[0];
                // Select the top three concepts based on lowest support values

                // Loop through sources to find closest opposing source
                // For example, if my source was The New York Times with a score of -0.11, then I'd find the National Review with a score of 0.11.
                var blahblahblah = [];
                console.log(blahblahblah);
                blahblahblah.length = 0; // Clear array
                var currentSpread = 100000.0;
                console.log(blahblahblah);
                for (var i = 0; i < newsSources.length; i++) {
                    console.log("----------------");
                    var proposedSource = newsSources[i];
                    console.log("proposedSource: " + proposedSource.Source);
                    console.log(proposedSource);
                    var proposedSpread = Math.abs(parseFloat(proposedSource['Calculated Political Bias']) + politicalBias);
                    console.log("proposedSpread: " + proposedSpread)
                    console.log("currentSpread: " + currentSpread);
                    console.log(blahblahblah);
                    proposedSource.index = i;
                    if (proposedSpread == currentSpread) { // Proposed source equal to lowest found so far, add it
                        blahblahblah.push(proposedSource);
                        console.log("adding...");
                    }
                    else if (proposedSpread < currentSpread) { // Proposed source less than lowest found so far, so make it the new lowest
                        //blahblahblah.length = 0; // Clear opposing sources array
                        //blahblahblah.push(proposedSource);
                        blahblahblah = null;
                        blahblahblah = [proposedSource];
                        currentSpread = proposedSpread;
                        console.log("replacing...");
                    }
                    console.log(blahblahblah);
                }

                console.log(blahblahblah);
                console.log("Spread after narrowing to closest opposing source: " + currentSpread);

                var bucketSize = 5;
                while (blahblahblah.length <= bucketSize) { // Bucket building
                    if (blahblahblah[0].index - 1 < 0) { // Edge case: lowest source already included, so add next highest source
                        blahblahblah.push(newsSources[blahblahblah[blahblahblah.length - 1].index + 1]);
                    }
                    else if (blahblahblah[0].index + 1 >= blahblahblah.length) { // Edge case: highest source already included, so add next lowest source
                        blahblahblah.push(newsSources[blahblahblah[0].index - 1]);
                    }

                    var first = blahblahblah[0];
                    var last = blahblahblah[blahblahblah.length - 1];
                    var lowerCandidate = newsSources[first.index - 1];
                    var upperCandidate = newsSources[last.index + 1];
                    var lowerSpread = Math.abs(first['Calculated Political Bias'] - lowerCandidate['Calculated Political Bias']);
                    var upperSpread = Math.abs(last['Calculated Political Bias'] - upperCandidate['Calculated Political Bias']);

                    if (lowerSpread <= upperSpread) {
                        blahblahblah.unshift(lowerCandidate); // Add lower candidate to beginning of array
                    }
                    if (lowerSpread >= upperSpread) {
                        blahblahblah.push(upperCandidate); // Add upper candidate to to end of array
                    }

                    console.log(blahblahblah);
                }

                //console.log(blahblahblah);


                // Randomize array
                blahblahblah = shuffle(blahblahblah);

                // Loop through opposing sources until an article is found on Bing
                for (var i = 0; i < blahblahblah.length; i++) {
                    var opposingSource = blahblahblah[i];
                    console.log(opposingSource);

                    // Search Bing for the top three concepts and the opposing source and select first article from the oppsing source
                    var query = datArr[0][0] + " "+ datArr[1][0]+ " site:" + trimUrl(opposingSource.URL);

                    bing_web_search(query, function(callback) {
                        var parsedJSON = JSON.parse(callback);
                        console.log(parsedJSON);

                        if (typeof parsedJSON.webPages != "undefined") {
                            var searchResults = parsedJSON.webPages.value;

                            for (var i = 0; i < searchResults.length; i++) {
                                var finalUrl = searchResults[i].url;
                                if (trimUrl(finalUrl) === trimUrl(opposingSource.URL)) {
                                    document.getElementById("title").innerHTML = "Here's an article from another viewpoint:"
                                        + " &nbsp;&nbsp;&nbsp;&nbsp; <a target=\"_blank\" href=\"" + finalUrl + "\">Read it in full here</a>";
                                    frame.src = searchResults[i].url;
                                    console.log("Displaying article with URL: " + frame.src);
                                    return;
                                }
                            }
                        }
                    });
                }

                // Couldn't find an opposing article
                document.getElementById("title").innerHTML = "Whoops, this is embarassing. We couldn't find a comparable article. For now, please try another article.";
            });
        });
    });
}, false);

/*function httpGet(theUrl) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", theUrl, false); // false for synchronous request
    xmlHttp.send(null);
    return xmlHttp.responseText;
}*/

function compareSecondColumn(a, b) {
    if (a[1] === b[1]) {
        return 0;
    }
    else {
        return (a[1] < b[1]) ? -1 : 1;
    }
}

function httpGetAsync(theUrl, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            callback(xmlHttp.responseText);
        }
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous
    xmlHttp.send(null);
}

function trimUrl(url) {
    return (url.split("//")[1]).split("/")[0];
}

function bing_web_search(query, callback) {
    console.log('Searching the Web for: ' + query);

    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            callback(xmlHttp.responseText);
        }
    }
    var url = "https://" + host + path + "?q=" + encodeURIComponent(query);
    //console.log(url);
    xmlHttp.open("GET", url, true);
    xmlHttp.setRequestHeader('Ocp-Apim-Subscription-Key', microsoftSubscriptionKey);
    xmlHttp.send(null);
}

function aylien_concept_extraction(url, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
            callback(xmlHttp.responseText);
        }
    }
    console.log(aylienConceptExtractionEndpoint + "?url=" + url);
    xmlHttp.open("GET", aylienConceptExtractionEndpoint + "?url=" + url, true);
    xmlHttp.setRequestHeader(aylienApplicationKeyHeader, aylienApplicationKey);
    xmlHttp.setRequestHeader(aylienApplicationIdHeader, aylienApplicationId);
    xmlHttp.send(null);
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}