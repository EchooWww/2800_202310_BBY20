// This function uses the Google Maps JavaScript API to show a list of fast food restaurants near the user's location
// It assumes that the user has granted permission to access their location and that the Google Maps script has been loaded
// It also assumes that there is a div element with id="map" to display the map and a ul element with id="list" to display the list

// A global variable to store the user's location
var userLocation;

// A global variable to store the names and vicinities of the results
var resultNamesAndVicinities = [];

// A function to get the user's location using the Geolocation API
function getUserLocation() {
  // Check if the browser supports geolocation
  if (navigator.geolocation) {
    // Get the current position of the user
    navigator.geolocation.getCurrentPosition(
      function (position) {
        // Store the user's location as a Google Maps LatLng object
        userLocation = new google.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude
        );
        // Call the function to show the map and the list
        showMapAndList();
      },
      function (error) {
        // Handle errors
        alert("Error getting user location: " + error.message);
      }
    );
  } else {
    // Browser does not support geolocation
    alert("Geolocation is not supported by this browser.");
  }
}
// A function to show the map and the list of fast food restaurants near the user's location
function showMapAndList() {
  // Create a new Google Maps object with some options
  var map = new google.maps.Map(document.getElementById("map"), {
    center: userLocation, // Center the map at the user's location
    zoom: 13, // Set the zoom level
    mapTypeId: google.maps.MapTypeId.ROADMAP, // Set the map type
  });

  // Create a new Google Maps PlacesService object to search for places
  var service = new google.maps.places.PlacesService(map);

  // Define the search parameters
  // Define an array of keywords to search for
  var keywords = ["KFC", "McDonald's", "Subway", "Tim Hortons"];
  var sortByDistance = [];
  var promises = [];

  // Loop through the keywords array
  for (var i = 0; i < keywords.length; i++) {
    // Get the current keyword
    var keyword = keywords[i];
    // Define the search parameters with the current keyword
    var request = {
      location: userLocation, // Search near the user's location
      radius: 2000, // Search within 3 km
      type: "restaurant", // Search for restaurants
      keyword: keyword, // Search for the current keyword
    };
    // Perform a nearby search using the PlacesService object with the current request
    var promise = new Promise(function (resolve, reject) {
      // Perform a nearby search using the PlacesService object with the current request
      service.nearbySearch(request, function (results, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          // Loop through the results array
          for (var j = 0; j < results.length; j++) {
            // Get the current result object
            var result = results[j];
            var name = result.name;
            var vicinity = result.vicinity;
            // Get the straight distance between the user's location and the result's location using the geometry library
            var distance =
              Math.round(
                google.maps.geometry.spherical.computeDistanceBetween(
                  userLocation,
                  result.geometry.location
                ) / 10
              ) / 100;
            sortByDistance.push({
              name: name,
              vicinity: vicinity,
              distance: distance,
            });
          }
          // Resolve the promise with a success message
          resolve("Search completed");
        } else {
          // Reject the promise with an error message
          reject("Search failed");
        }
      });
    });
    // Push the promise to the promises array
    promises.push(promise);
  }
  Promise.all(promises)
    .then(function (messages) {
      // If all promises are resolved, sort and display the sortByDistance array
      console.log(messages); // Log the success messages
      // Sort the sortByDistance array by distance in ascending order
      sortByDistance.sort(function (a, b) {
        // Convert the distance strings to numbers using parseFloat
        return parseFloat(a.distance) - parseFloat(b.distance);
      });
      console.log(sortByDistance); // Log the sorted array
      // Display the sorted results in the list after all promises are resolved
      for (var k = 0; k < Math.min(sortByDistance.length, 6); k++) {
        var li = document.createElement("li");
        li.innerHTML =
          sortByDistance[k].name + " - " + sortByDistance[k].distance + "KM";

        var link = document.createElement("a");
        link.href =
          "https://www.google.com/maps/search/?api=1&query=" +
          sortByDistance[k].name +
          "+" +
          sortByDistance[k].vicinity; // Use the query parameter with the place name and address
        // Use the query parameter with the latitude and longitude of the result
        // Alternatively, you can use the place_id parameter with the place_id of the result
        // link.href = "https://www.google.com/maps/search/?api=1&query_place_id=" + sortByDistance[k].place_id;
        link.target = "_blank"; // Open the link in a new tab
        link.innerHTML =
          '<span class="material-symbols-outlined">near_me</span>';
        // Append the link element to the list item
        li.appendChild(link);
        document.getElementById("list").appendChild(li);
      }
    })
    .catch(function (error) {
      // If any promise is rejected, log the error message and stop execution
      console.error(error); // Log the error message
      return; // Stop execution
    });
}

// Call the function to get the user's location when the page loads
getUserLocation();