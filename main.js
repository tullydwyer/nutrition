const constraints = {
    "Vitamin C (mg)": {
        min: 45
    },
    "Vitamin A retinol equivalents (ug)": {
        min: 900
    },
    "Protein (g)": {
        min: 50
    },
    "Zinc (Zn) (mg)": {
        min: 10,
        max: 40
    },
    "Vitamin E (mg)": {
        max: 300
    },
    "Vitamin D3 equivalents (ug)": {
        max: 80
    },
    "Thiamin (B1) (mg)": {
        min: 1.0
    },
    "Selenium (Se) (ug)": {
        min: 50,
        max: 400
    },
    "Riboflavin (B2) (mg)": {
        min: 1.0
    },
    "Phosphorus (P) (mg)": {
        min: 700,
        max: 4000
    },
    "Molybdenum (Mo) (ug)": {
        min: 30,
        max: 2000
    },
    "Magnesium (Mg) (mg)": {
        min: 300
    },
    "Iron (Fe) (mg)": {
        min: 8,
        max: 45
    },
    "Iodine (I) (ug)": {
        min: 100,
        max: 1100
    },
    "Dietary folate equivalents (ug)": {
        min: 300,
        max: 1000
    },
    "Copper (Cu) (mg)": {
        max: 10
    },
    "Total dietary fibre (g)": {
        min: 20
    },
    "Sodium (Na) (mg)": {
        min: 400,
        max: 2300
    },
    "grams": {
        max: 1500
    }
}

// Initialize data as an empty object
var data = {};
var csvParser;
var isDataLoaded = false;

class ExcelToJSON {
    constructor() {
        this.parseCSV = function (file) {
            var reader = new FileReader();

            reader.onload = function (e) {
                var csvData = e.target.result;
                var lines = csvData.split('\n');
                
                // Clean the header row and handle quoted fields
                var headerLine = lines[0];
                var headers = [];
                var inQuotes = false;
                var currentHeader = '';
                
                for (var i = 0; i < headerLine.length; i++) {
                    var char = headerLine[i];
                    if (char === '"' && (i === 0 || headerLine[i-1] !== '\\')) {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        headers.push(currentHeader.replace(/['"]+/g, '').trim());
                        currentHeader = '';
                    } else {
                        currentHeader += char;
                    }
                }
                
                // Add the last header
                if (currentHeader) {
                    headers.push(currentHeader.replace(/['"]+/g, '').trim());
                }
                
                console.log("CSV Headers found:", headers.length);
                
                var json_object = [];
                
                // Process each data row
                for (var i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === '') continue; // Skip empty lines
                    
                    // Parse this line carefully
                    var currentline = [];
                    inQuotes = false;
                    var currentValue = '';
                    
                    for (var j = 0; j < lines[i].length; j++) {
                        var char = lines[i][j];
                        
                        if (char === '"' && (j === 0 || lines[i][j-1] !== '\\')) {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            currentline.push(currentValue);
                            currentValue = '';
                        } else {
                            currentValue += char;
                        }
                    }
                    
                    // Add the last value
                    currentline.push(currentValue);
                    
                    // Skip if we don't have enough values
                    if (currentline.length < 3) continue;
                    
                    var obj = {};
                    for (var j = 0; j < headers.length && j < currentline.length; j++) {
                        var value = currentline[j].replace(/['"]+/g, '').trim(); // Remove quotes and trim
                        obj[headers[j]] = isNaN(value) ? value : Number(value);
                    }
                    
                    // Only add if we have a valid food name
                    if (obj["Food Name"] && obj["Food Name"].trim() !== '') {
                        json_object.push(obj);
                    }
                }
                
                console.log("Parsed", json_object.length, "food items from CSV");

                var objects = {};

                // Create the object with food names as keys
                for (var i = 0; i < json_object.length; i++) {
                    var foodName = json_object[i]["Food Name"];
                    if (foodName) {
                        objects[foodName] = {};
                        
                        // Add a grams property that represents the "cost" of 1 unit of this food
                        objects[foodName]["grams"] = 1;
                        
                        // Convert all numeric values to per gram
                        for (var prop in json_object[i]) {
                            var cleanProp = prop.replace(/(\r\n|\n|\r)/gm, "").replace("&#10;", "");
                            
                            // Skip non-numeric for optimization except Food Name
                            if (prop !== "Food Name" && isNaN(json_object[i][prop])) {
                                continue;
                            }
                            
                            if (cleanProp in constraints && !isNaN(json_object[i][prop])) {
                                // This is a constraint property, so add it to our object
                                objects[foodName][cleanProp] = Number(json_object[i][prop])/100;
                            } else {
                                // Still add the property for display purposes
                                objects[foodName][cleanProp] = json_object[i][prop];
                            }
                        }
                    }
                }

                console.log("Final data object created");
                console.log("Number of food items loaded:", Object.keys(objects).length);
                
                // Debug: Log a sample food item to check the data format
                const sampleKey = Object.keys(objects)[0];
                if (sampleKey) {
                    console.log("Sample food item:", sampleKey, objects[sampleKey]);
                }
                
                // Debug: Check if our constraint properties exist in the data
                for (const nutrient in constraints) {
                    let foundInAnyFood = false;
                    for (const food in objects) {
                        if (objects[food][nutrient] !== undefined) {
                            foundInAnyFood = true;
                            break;
                        }
                    }
                    console.log(`Constraint "${nutrient}" ${foundInAnyFood ? 'found' : 'NOT FOUND'} in food data`);
                }
                
                data = objects;
                isDataLoaded = true;
                
                // Now that data is loaded, solve and display results
                solve();
                displayFoodList();
            };

            reader.onerror = function (ex) {
                console.error("Error reading file:", ex);
                document.getElementById('result').innerHTML = "<p style='color:red'>Error loading data: " + ex.message + "</p>";
            };

            reader.readAsText(file);
        };
    }
}

function solve() {
    if (!isDataLoaded) {
        document.getElementById('result').innerHTML = "<p>Data is still loading. Please wait...</p>";
        return;
    }
    
    // Check if we have enough data
    if (Object.keys(data).length === 0) {
        document.getElementById('result').innerHTML = "<p style='color:red'>Error: No food data was loaded. Please try reloading the page.</p>";
        return;
    }
    
    console.log("Starting optimization with", Object.keys(data).length, "food items");
    
    try {
        // Start with original constraints
        let model = {
            optimize: "grams",
            opType: "min",
            constraints: constraints,
            variables: data,
            options: {
                tolerance: 0.2 // Increased tolerance
            }
        };

        // Try to solve with original constraints
        let results = solver.Solve(model);
        let resultHTML = "<h2>Optimization Results</h2>";
        
        // If not feasible, try with more relaxed constraints
        if (!results.feasible) {
            console.log("No solution with original constraints, trying relaxed constraints");
            
            // Create relaxed constraints - reduce minimums by 30% and increase maximums by 30%
            const relaxedConstraints = {};
            for (const nutrient in constraints) {
                relaxedConstraints[nutrient] = {};
                if (constraints[nutrient].min !== undefined) {
                    relaxedConstraints[nutrient].min = constraints[nutrient].min * 0.7;
                }
                if (constraints[nutrient].max !== undefined) {
                    relaxedConstraints[nutrient].max = constraints[nutrient].max * 1.3;
                }
            }
            
            model.constraints = relaxedConstraints;
            model.options.tolerance = 0.3; // Further increase tolerance
            
            results = solver.Solve(model);
            
            if (results.feasible) {
                resultHTML += "<p><strong>Status:</strong> Solution found with relaxed constraints!</p>";
                resultHTML += "<p><em>Note: Some nutritional requirements were relaxed to find a solution.</em></p>";
            }
        } else {
            resultHTML += "<p><strong>Status:</strong> Solution found!</p>";
        }
        
        if (results.feasible) {
            resultHTML += "<p><strong>Total grams needed:</strong> " + Math.round(results.result) + "g</p>";
            
            resultHTML += "<h3>Recommended Foods:</h3><ul>";
            
            // Display the foods and amounts
            for (let foodName in results) {
                if (foodName !== 'feasible' && foodName !== 'result' && foodName !== 'bounded' && 
                    foodName !== 'isIntegral' && results[foodName] > 0) {
                    resultHTML += "<li>" + foodName + ": " + Math.round(results[foodName] * 100) / 100 + "g</li>";
                }
            }
            
            resultHTML += "</ul>";
            
            // If we couldn't find a solution with the relaxed constraints, try a different approach
        } else {
            // If still not feasible, try a solution with fewer constraints
            console.log("No solution with relaxed constraints, trying minimal constraints");
            
            // Try with just a few essential constraints
            const minimalConstraints = {
                "Protein (g)": { min: 40 },
                "Vitamin C (mg)": { min: 30 },
                "grams": { max: 2000 }
            };
            
            model.constraints = minimalConstraints;
            model.options.tolerance = 0.5; // Further increase tolerance
            
            results = solver.Solve(model);
            
            if (results.feasible) {
                resultHTML += "<p><strong>Status:</strong> Basic solution found!</p>";
                resultHTML += "<p><em>Warning: Only basic nutritional requirements were considered.</em></p>";
                resultHTML += "<p><strong>Total grams needed:</strong> " + Math.round(results.result) + "g</p>";
                
                resultHTML += "<h3>Recommended Foods:</h3><ul>";
                
                // Display the foods and amounts
                for (let foodName in results) {
                    if (foodName !== 'feasible' && foodName !== 'result' && foodName !== 'bounded' && 
                        foodName !== 'isIntegral' && results[foodName] > 0) {
                        resultHTML += "<li>" + foodName + ": " + Math.round(results[foodName] * 100) / 100 + "g</li>";
                    }
                }
                
                resultHTML += "</ul>";
            } else {
                resultHTML += "<p><strong>Status:</strong> No feasible solution found.</p>";
                resultHTML += "<p>The nutritional requirements could not be met with the available foods.</p>";
                resultHTML += "<p>Suggestions:</p><ul>";
                resultHTML += "<li>Check if the CSV data is properly formatted</li>";
                resultHTML += "<li>Verify that the food data includes nutritional information for the constraints</li>";
                resultHTML += "<li>Try with a different set of food items</li></ul>";
            }
        }
        
        document.getElementById('result').innerHTML = resultHTML;
    } catch (error) {
        console.error("Error during optimization:", error);
        document.getElementById('result').innerHTML = "<p style='color:red'>Error during optimization: " + error.message + "</p>";
    }
}

function fun() {
    console.log("Loading and processing data...");
    document.getElementById("result").innerHTML = "<p>Loading and processing nutritional data...</p>";
    
    if (!csvParser) {
        csvParser = new ExcelToJSON();
    }
    
    // Use the CSV file
    const url = "./nutrients.csv";
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }
            return response.blob();
        })
        .then(blob => {
            // Create a File object to pass to the parseCSV function
            const file = new File([blob], 'temp.csv', { type: 'text/csv' });
            csvParser.parseCSV(file);
        })
        .catch(error => {
            console.error('Error fetching file:', error);
            document.getElementById('result').innerHTML = "<p style='color:red'>Error loading data: " + error.message + "</p>";
        });
}

function displayFoodList() {
    if (!isDataLoaded) {
        document.getElementById('checkbox-filter').innerHTML = "<p>Loading data...</p>";
        return;
    }
    
    let html = '<h2>Available Foods</h2><div class="food-list">';
    
    for (let foodName in data) {
        html += `
            <div class="food-item">
                <h3>${foodName}</h3>
                <p>Public Food Key: ${data[foodName]["Public Food Key"] || 'N/A'}</p>
            </div>
        `;
    }
    
    html += '</div>';
    document.getElementById('checkbox-filter').innerHTML = html;
}

// Load data when the page loads
document.addEventListener("DOMContentLoaded", function(event) {
    console.log("Page loaded, starting data load");
    fun();
});