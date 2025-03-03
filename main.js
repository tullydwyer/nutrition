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

// Constants
const EPSILON = 0.0001;  // Small tolerance for floating point comparison (0.01%)

// Initialize data as an empty object
var data = {};
var csvParser;
var isDataLoaded = false;
var enabledFoods = new Set(); // Store enabled food items

let nutritionChart = null;

// Add functions for localStorage management
function saveEnabledFoods() {
    localStorage.setItem('enabledFoods', JSON.stringify(Array.from(enabledFoods)));
}

function loadEnabledFoods() {
    const saved = localStorage.getItem('enabledFoods');
    if (saved) {
        enabledFoods = new Set(JSON.parse(saved));
    }
}

function toggleFood(foodName) {
    if (enabledFoods.has(foodName)) {
        enabledFoods.delete(foodName);
    } else {
        enabledFoods.add(foodName);
    }
    
    // Update the UI to reflect the change
    const foodItem = document.querySelector(`[data-food-name="${foodName}"]`);
    if (foodItem) {
        foodItem.classList.toggle('disabled', !enabledFoods.has(foodName));
    }
    
    // Save to localStorage
    saveEnabledFoods();
    
    // Re-run optimization if data is loaded
    if (isDataLoaded) {
        solve();
    }
}

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
                            
                            // Skip non-numeric for optimization except Food Name and enabled
                            if (prop !== "Food Name" && prop !== "enabled" && isNaN(json_object[i][prop])) {
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

                        // Add to enabledFoods if enabled in CSV and no localStorage data exists
                        if (localStorage.getItem('enabledFoods') === null && json_object[i]["enabled"] === 1) {
                            enabledFoods.add(foodName);
                        }
                    }
                }

                console.log("Final data object created");
                console.log("Number of food items loaded:", Object.keys(objects).length);
                
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

function updateStats(results) {
    const totalFoods = Object.keys(results).filter(key => 
        key !== 'feasible' && 
        key !== 'result' && 
        key !== 'bounded' && 
        key !== 'isIntegral' && 
        results[key] > 0
    ).length;

    const totalWeight = Math.round(results.result);
    
    // Calculate nutrients met
    let nutrientsMet = 0;
    let totalNutrients = 0;
    
    for (const nutrient in constraints) {
        if (nutrient === 'grams') continue;
        totalNutrients++;
        
        let totalAmount = 0;
        for (const food in results) {
            if (food !== 'feasible' && food !== 'result' && food !== 'bounded' && food !== 'isIntegral' && results[food] > 0) {
                totalAmount += (data[food][nutrient] || 0) * results[food];
            }
        }
        
        console.log(`${nutrient}: Amount = ${totalAmount}`);
        if (constraints[nutrient].min && constraints[nutrient].max) {
            // For nutrients with both min and max, must be within range
            if (totalAmount >= constraints[nutrient].min - EPSILON && totalAmount <= constraints[nutrient].max + EPSILON) {
                nutrientsMet++;
                console.log(`  ✓ Met (within range ${constraints[nutrient].min} - ${constraints[nutrient].max})`);
            } else {
                console.log(`  ✗ Not met (outside range ${constraints[nutrient].min} - ${constraints[nutrient].max})`);
            }
        } else if (constraints[nutrient].min && totalAmount >= constraints[nutrient].min - EPSILON) {
            nutrientsMet++;
            console.log(`  ✓ Met (>= min ${constraints[nutrient].min})`);
        } else if (constraints[nutrient].max && totalAmount <= constraints[nutrient].max + EPSILON) {
            nutrientsMet++;
            console.log(`  ✓ Met (<= max ${constraints[nutrient].max})`);
        } else {
            console.log(`  ✗ Not met`);
        }
    }

    document.getElementById('total-foods').textContent = totalFoods;
    document.getElementById('total-weight').textContent = `${totalWeight}g`;
    document.getElementById('nutrients-met').textContent = `${nutrientsMet}/${totalNutrients}`;
}

function updateNutritionChart(results) {
    const nutrients = {};
    const requirements = {};
    
    // Calculate total nutrients
    for (const nutrient in constraints) {
        if (nutrient === 'grams') continue;
        
        nutrients[nutrient] = 0;
        requirements[nutrient] = constraints[nutrient].min || constraints[nutrient].max || 0;
        
        for (const food in results) {
            if (food !== 'feasible' && food !== 'result' && food !== 'bounded' && food !== 'isIntegral' && results[food] > 0) {
                nutrients[nutrient] += (data[food][nutrient] || 0) * results[food];
            }
        }
    }

    // Create table HTML
    let tableHTML = `
        <div class="nutrition-table-container">
            <table class="nutrition-table">
                <thead>
                    <tr>
                        <th>Nutrient</th>
                        <th>Current</th>
                        <th>Required Range</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const nutrient in nutrients) {
        const currentAmount = Math.round(nutrients[nutrient] * 100) / 100;
        let status = '';
        let statusClass = '';
        let percentage = 0;

        // Extract unit from nutrient name
        const unitMatch = nutrient.match(/\((.*?)\)/g);
        let unit = '';
        if (unitMatch) {
            // Take the last unit in parentheses
            const lastUnit = unitMatch[unitMatch.length - 1];
            unit = lastUnit.replace(/[()]/g, '').trim();
        }

        // Build the requirements text
        let requirementsText = '';
        if (constraints[nutrient].min && constraints[nutrient].max) {
            requirementsText = `${constraints[nutrient].min} - ${constraints[nutrient].max} ${unit}`;
            // Check both min and max
            if (currentAmount >= constraints[nutrient].min - EPSILON && currentAmount <= constraints[nutrient].max + EPSILON) {
                status = '✓ Within range';
                statusClass = 'success';
                percentage = 100;
            } else if (currentAmount < constraints[nutrient].min - EPSILON) {
                percentage = (currentAmount / constraints[nutrient].min) * 100;
                status = `${Math.round(percentage)}% of min`;
                statusClass = percentage > 70 ? 'warning' : 'error';
            } else {
                percentage = (currentAmount / constraints[nutrient].max) * 100;
                status = `${Math.round(percentage)}% of max`;
                statusClass = 'error';
            }
        } else if (constraints[nutrient].min) {
            requirementsText = `≥ ${constraints[nutrient].min} ${unit}`;
            percentage = (currentAmount / constraints[nutrient].min) * 100;
            if (currentAmount >= constraints[nutrient].min - EPSILON) {
                status = '✓ Met';
                statusClass = 'success';
            } else {
                status = `${Math.round(percentage)}% of min`;
                statusClass = percentage > 70 ? 'warning' : 'error';
            }
        } else if (constraints[nutrient].max) {
            requirementsText = `≤ ${constraints[nutrient].max} ${unit}`;
            percentage = (currentAmount / constraints[nutrient].max) * 100;
            if (currentAmount <= constraints[nutrient].max + EPSILON) {
                status = '✓ Within limit';
                statusClass = 'success';
            } else {
                status = `${Math.round(percentage)}% of max`;
                statusClass = 'error';
            }
        }

        // Clean up nutrient name and ensure unit is shown consistently
        const cleanNutrientName = nutrient.replace(/\s*\([^)]*\)/, '');
        
        tableHTML += `
            <tr>
                <td>${cleanNutrientName}</td>
                <td class="numeric">${currentAmount} ${unit}</td>
                <td class="numeric">${requirementsText}</td>
                <td class="status ${statusClass}">
                    <div class="status-bar" style="width: ${Math.min(100, percentage)}%"></div>
                    <span>${status}</span>
                </td>
            </tr>
        `;
    }

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Add table styles
    if (!document.getElementById('nutrition-table-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'nutrition-table-styles';
        styleSheet.textContent = `
            .nutrition-table-container {
                overflow-x: auto;
                margin-top: 1rem;
            }
            .nutrition-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.875rem;
            }
            .nutrition-table th,
            .nutrition-table td {
                padding: 0.5rem;
                text-align: left;
                border-bottom: 1px solid var(--border-color);
                white-space: nowrap;
            }
            .nutrition-table th {
                background-color: var(--background-color);
                font-weight: 500;
                color: var(--text-secondary);
            }
            .nutrition-table .numeric {
                font-family: monospace;
                text-align: right;
            }
            .nutrition-table .status {
                position: relative;
                width: 150px;
            }
            .status-bar {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                background-color: rgba(37, 99, 235, 0.1);
                z-index: 0;
            }
            .status span {
                position: relative;
                z-index: 1;
                padding-left: 0.5rem;
            }
            .status.success {
                color: var(--success-color);
            }
            .status.success .status-bar {
                background-color: rgba(34, 197, 94, 0.1);
            }
            .status.warning {
                color: var(--warning-color);
            }
            .status.warning .status-bar {
                background-color: rgba(245, 158, 11, 0.1);
            }
            .status.error {
                color: var(--error-color);
            }
            .status.error .status-bar {
                background-color: rgba(239, 68, 68, 0.1);
            }
        `;
        document.head.appendChild(styleSheet);
    }

    // Update the chart container with the table
    document.querySelector('.chart-container').innerHTML = tableHTML;
}

function solve() {
    if (!isDataLoaded) {
        document.getElementById('result').innerHTML = "<p>Data is still loading. Please wait...</p>";
        return;
    }
    
    if (Object.keys(data).length === 0) {
        document.getElementById('result').innerHTML = "<p style='color:red'>Error: No food data was loaded. Please try reloading the page.</p>";
        return;
    }
    
    console.log("Starting optimization with", Object.keys(data).length, "food items");
    
    try {
        // Filter out disabled foods
        const enabledFoodData = {};
        for (const foodName in data) {
            if (enabledFoods.has(foodName)) {
                enabledFoodData[foodName] = data[foodName];
            }
        }

        let model = {
            optimize: "grams",
            opType: "min",
            constraints: constraints,
            variables: enabledFoodData,
            options: {
                tolerance: 0.2
            }
        };

        let results = solver.Solve(model);
        let resultHTML = "<h2>Optimization Results</h2>";
        
        if (!results.feasible) {
            console.log("No solution with original constraints, trying relaxed constraints");
            
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
            model.options.tolerance = 0.3;
            
            results = solver.Solve(model);
            
            if (results.feasible) {
                resultHTML += "<div class='warning'>Solution found with relaxed constraints. Some nutritional requirements were adjusted to find a feasible solution.</div>";
            }
        } else {
            resultHTML += "<div style='color: var(--success-color); margin-bottom: 1rem;'>✓ Optimal solution found!</div>";
        }
        
        if (results.feasible) {
            // Move the stats grid here
            resultHTML += `<div class='stats-grid'>
                <div class='stat-card'>
                    <h3>Foods</h3>
                    <div class='value' id='total-foods'>-</div>
                </div>
                <div class='stat-card'>
                    <h3>Weight</h3>
                    <div class='value' id='total-weight'>-</div>
                </div>
                <div class='stat-card'>
                    <h3>Nutrients</h3>
                    <div class='value' id='nutrients-met'>-</div>
                </div>
            </div>`;

            resultHTML += `<div style='font-size: 1.25rem; margin-bottom: 1rem;'>
                Total weight: <strong>${Math.round(results.result)}g</strong>
            </div>`;
            
            resultHTML += "<div class='food-list'>";
            
            for (let foodName in results) {
                if (foodName !== 'feasible' && foodName !== 'result' && foodName !== 'bounded' && 
                    foodName !== 'isIntegral' && results[foodName] > 0) {
                    resultHTML += `
                        <div class='food-item'>
                            <h3>${foodName}</h3>
                            <p style='color: var(--text-secondary);'>${Math.round(results[foodName] * 100) / 100}g</p>
                        </div>
                    `;
                }
            }
            
            resultHTML += "</div>";
            
            // First set the HTML content
            document.getElementById('result').innerHTML = resultHTML;
            
            // Then update stats and chart after the elements exist in the DOM
            updateStats(results);
            updateNutritionChart(results);
            
        } else {
            resultHTML += `
                <div style='color: var(--error-color); margin-bottom: 1rem;'>
                    No feasible solution found
                </div>
                <p>The nutritional requirements could not be met with the available foods.</p>
                <ul style='color: var(--text-secondary);'>
                    <li>Check if the CSV data is properly formatted</li>
                    <li>Verify that the food data includes nutritional information for the constraints</li>
                    <li>Try with a different set of food items</li>
                </ul>
            `;
            
            document.getElementById('result').innerHTML = resultHTML;
        }
        
    } catch (error) {
        console.error("Error during optimization:", error);
        document.getElementById('result').innerHTML = `
            <div style='color: var(--error-color);'>
                Error during optimization: ${error.message}
            </div>
        `;
    }
}

function fun() {
    console.log("Loading and processing data...");
    document.getElementById("result").innerHTML = "<p>Loading and processing nutritional data...</p>";
    
    // Load saved foods from localStorage
    loadEnabledFoods();
    
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
    
    let html = '<div class="food-list">';
    
    for (let foodName in data) {
        const isEnabled = enabledFoods.has(foodName);
        html += `
            <div class='food-item ${!isEnabled ? 'disabled' : ''}' data-food-name="${foodName}">
                <div class="food-item-info">
                    <h3>${foodName}</h3>
                    <p style='color: var(--text-secondary);'>
                        ${data[foodName]["Public Food Key"] || 'No ID'}
                    </p>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleFood('${foodName.replace(/'/g, "\\'")}')">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    }
    
    html += '</div>';
    document.getElementById('checkbox-filter').innerHTML = html;
}

function filterFoodList(searchTerm) {
    if (!isDataLoaded) return;
    
    searchTerm = searchTerm.toLowerCase();
    const foodItems = document.querySelectorAll('.food-item');
    
    foodItems.forEach(item => {
        const foodName = item.getAttribute('data-food-name').toLowerCase();
        const shouldShow = foodName.includes(searchTerm);
        item.style.display = shouldShow ? '' : 'none';
    });
}

// Load data when the page loads
document.addEventListener("DOMContentLoaded", function(event) {
    console.log("Page loaded, starting data load");
    fun();
});