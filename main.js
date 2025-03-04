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
var dailyFraction = 1; // Store the daily intake fraction

let nutritionChart = null;

// Make updateDailyFraction available globally
function updateDailyFraction(value) {
    dailyFraction = parseFloat(value);
    if (isDataLoaded) {
        solve();
    }
}

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
    
    // Save to localStorage
    saveEnabledFoods();
    
    // Re-run optimization if data is loaded
    if (isDataLoaded) {
        solve();
    }

    // Update the display to reflect the new order
    displayFoodList();
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
            const scaledMin = constraints[nutrient].min * dailyFraction;
            const scaledMax = constraints[nutrient].max * dailyFraction;
            if (totalAmount >= scaledMin - EPSILON && totalAmount <= scaledMax + EPSILON) {
                nutrientsMet++;
                console.log(`  ✓ Met (within range ${scaledMin} - ${scaledMax})`);
            } else {
                console.log(`  ✗ Not met (outside range ${scaledMin} - ${scaledMax})`);
            }
        } else if (constraints[nutrient].min && totalAmount >= constraints[nutrient].min * dailyFraction - EPSILON) {
            nutrientsMet++;
            console.log(`  ✓ Met (>= min ${constraints[nutrient].min * dailyFraction})`);
        } else if (constraints[nutrient].max && totalAmount <= constraints[nutrient].max * dailyFraction + EPSILON) {
            nutrientsMet++;
            console.log(`  ✓ Met (<= max ${constraints[nutrient].max * dailyFraction})`);
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
    const foodContributions = {};  // Track contributions per food
    
    // Calculate total nutrients and track contributions per food
    for (const nutrient in constraints) {
        if (nutrient === 'grams') continue;
        
        nutrients[nutrient] = 0;
        requirements[nutrient] = constraints[nutrient].min || constraints[nutrient].max || 0;
        foodContributions[nutrient] = [];
        
        for (const food in results) {
            if (food !== 'feasible' && food !== 'result' && food !== 'bounded' && food !== 'isIntegral' && results[food] > 0) {
                const contribution = (data[food][nutrient] || 0) * results[food];
                nutrients[nutrient] += contribution;
                if (contribution > 0) {
                    foodContributions[nutrient].push({
                        food: food,
                        amount: contribution,
                        percentage: (contribution / nutrients[nutrient]) * 100
                    });
                }
            }
        }
        // Sort contributions by amount
        foodContributions[nutrient].sort((a, b) => b.amount - a.amount);
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
            const lastUnit = unitMatch[unitMatch.length - 1];
            unit = lastUnit.replace(/[()]/g, '').trim();
        }

        // Build the requirements text and determine status
        let requirementsText = '';
        if (constraints[nutrient].min && constraints[nutrient].max) {
            const scaledMin = Math.round(constraints[nutrient].min * dailyFraction * 100) / 100;
            const scaledMax = Math.round(constraints[nutrient].max * dailyFraction * 100) / 100;
            requirementsText = `${scaledMin} - ${scaledMax} ${unit} (${Math.round(dailyFraction * 100)}% of daily)`;
            if (currentAmount >= scaledMin - EPSILON && currentAmount <= scaledMax + EPSILON) {
                status = '✓ Within range';
                statusClass = 'success';
                percentage = 100;
            } else if (currentAmount < scaledMin - EPSILON) {
                percentage = (currentAmount / scaledMin) * 100;
                status = `${Math.round(percentage)}% of target`;
                statusClass = percentage > 70 ? 'warning' : 'error';
            } else {
                percentage = (currentAmount / scaledMax) * 100;
                status = `${Math.round(percentage)}% of max`;
                statusClass = 'error';
            }
        } else if (constraints[nutrient].min) {
            const scaledMin = Math.round(constraints[nutrient].min * dailyFraction * 100) / 100;
            requirementsText = `≥ ${scaledMin} ${unit} (${Math.round(dailyFraction * 100)}% of daily)`;
            percentage = (currentAmount / scaledMin) * 100;
            if (currentAmount >= scaledMin - EPSILON) {
                status = '✓ Met';
                statusClass = 'success';
            } else {
                status = `${Math.round(percentage)}% of target`;
                statusClass = percentage > 70 ? 'warning' : 'error';
            }
        } else if (constraints[nutrient].max) {
            const scaledMax = Math.round(constraints[nutrient].max * dailyFraction * 100) / 100;
            requirementsText = `≤ ${scaledMax} ${unit} (${Math.round(dailyFraction * 100)}% of daily)`;
            percentage = (currentAmount / scaledMax) * 100;
            if (currentAmount <= scaledMax + EPSILON) {
                status = '✓ Within limit';
                statusClass = 'success';
            } else {
                status = `${Math.round(percentage)}% of max`;
                statusClass = 'error';
            }
        }

        // Clean up nutrient name
        const cleanNutrientName = nutrient.replace(/\s*\([^)]*\)/, '');
        
        // Create expandable row with food contributions
        const contributionsHTML = foodContributions[nutrient].map(contribution => `
            <div class="food-contribution">
                <span class="food-name">${contribution.food}</span>
                <div class="contribution-bar-container">
                    <div class="contribution-bar" style="width: ${contribution.percentage}%"></div>
                    <span class="contribution-amount">${Math.round(contribution.amount * 100) / 100} ${unit}</span>
                </div>
            </div>
        `).join('');

        // Generate unique ID for the nutrient row
        const nutrientId = cleanNutrientName.toLowerCase().replace(/\s+/g, '-');

        tableHTML += `
            <tr class="nutrient-row" data-target="${nutrientId}" onclick="toggleNutrientDetails(this)">
                <td>${cleanNutrientName}</td>
                <td class="numeric">${currentAmount} ${unit}</td>
                <td class="numeric">${requirementsText}</td>
                <td class="status ${statusClass}">
                    <div class="status-bar" style="width: ${Math.min(100, percentage)}%"></div>
                    <span>${status}</span>
                </td>
            </tr>
            <tr class="nutrient-details" id="${nutrientId}-details" style="max-height: 0;">
                <td colspan="4">
                    <div class="contributions-container">
                        ${contributionsHTML}
                    </div>
                </td>
            </tr>
        `;
    }

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Update the chart container with the table
    document.querySelector('.chart-container').innerHTML = tableHTML;
}

// Add function to toggle nutrient details
function toggleNutrientDetails(row) {
    // Get the target details row
    const targetId = row.getAttribute('data-target');
    const detailsRow = document.getElementById(`${targetId}-details`);
    
    if (!detailsRow) return;
    
    const isExpanded = row.classList.contains('expanded');
    
    // First collapse all other rows
    document.querySelectorAll('.nutrient-row.expanded').forEach(expandedRow => {
        if (expandedRow !== row) {
            expandedRow.classList.remove('expanded');
            const expandedDetailsId = expandedRow.getAttribute('data-target');
            const expandedDetails = document.getElementById(`${expandedDetailsId}-details`);
            if (expandedDetails) {
                expandedDetails.classList.remove('expanded');
                expandedDetails.style.maxHeight = '0';
                // Wait for transition before hiding
                setTimeout(() => {
                    if (!expandedDetails.classList.contains('expanded')) {
                        expandedDetails.style.display = 'none';
                    }
                }, 300);
            }
        }
    });
    
    // Toggle the clicked row
    if (!isExpanded) {
        detailsRow.style.display = 'table-row';
        // Force a reflow
        detailsRow.offsetHeight;
        row.classList.add('expanded');
        detailsRow.classList.add('expanded');
        detailsRow.style.maxHeight = detailsRow.scrollHeight + 'px';
    } else {
        row.classList.remove('expanded');
        detailsRow.classList.remove('expanded');
        detailsRow.style.maxHeight = '0';
        // Wait for transition before hiding
        setTimeout(() => {
            if (!detailsRow.classList.contains('expanded')) {
                detailsRow.style.display = 'none';
            }
        }, 300);
    }
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

        // Apply daily fraction to constraints
        const scaledConstraints = {};
        for (const nutrient in constraints) {
            scaledConstraints[nutrient] = {};
            if (nutrient === 'grams') {
                // Scale the maximum grams proportionally
                scaledConstraints[nutrient].max = constraints[nutrient].max * dailyFraction;
            } else {
                if (constraints[nutrient].min !== undefined) {
                    scaledConstraints[nutrient].min = constraints[nutrient].min * dailyFraction;
                }
                if (constraints[nutrient].max !== undefined) {
                    scaledConstraints[nutrient].max = constraints[nutrient].max * dailyFraction;
                }
            }
        }

        let model = {
            optimize: "grams",
            opType: "min",
            constraints: scaledConstraints,
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
            for (const nutrient in scaledConstraints) {
                relaxedConstraints[nutrient] = {};
                if (scaledConstraints[nutrient].min !== undefined) {
                    relaxedConstraints[nutrient].min = scaledConstraints[nutrient].min * 0.7;
                }
                if (scaledConstraints[nutrient].max !== undefined) {
                    relaxedConstraints[nutrient].max = scaledConstraints[nutrient].max * 1.3;
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
                Total weight: <strong>${Math.round(results.result)}g</strong> (${Math.round(dailyFraction * 100)}% of daily intake)
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

function getNutrientContribution(foodName, amount) {
    const contributions = {};
    for (const nutrient in constraints) {
        if (nutrient === 'grams') continue;
        if (data[foodName][nutrient]) {
            contributions[nutrient] = data[foodName][nutrient] * amount;
        }
    }
    return contributions;
}

function getPercentageOfConstraint(value, nutrient) {
    if (!constraints[nutrient]) return 0;
    if (constraints[nutrient].min) {
        return (value / constraints[nutrient].min) * 100;
    }
    if (constraints[nutrient].max) {
        return (value / constraints[nutrient].max) * 100;
    }
    return 0;
}

function toggleFoodDetails(foodName) {
    const foodItem = document.querySelector(`[data-food-name="${foodName}"]`);
    const wasExpanded = foodItem.classList.contains('expanded');
    
    // Close all other expanded items
    document.querySelectorAll('.food-item.expanded').forEach(item => {
        if (item !== foodItem) {
            item.classList.remove('expanded');
        }
    });
    
    // Toggle current item
    foodItem.classList.toggle('expanded');
    
    // If we're expanding this item, calculate and show nutritional details
    if (!wasExpanded) {
        const detailsContainer = foodItem.querySelector('.food-item-details');
        if (!detailsContainer) return;
        
        // Calculate nutritional contribution for 100g
        const contributions = getNutrientContribution(foodName, 100);
        let detailsHTML = '<div class="nutrient-contributions">';
        
        // Show top 5 most significant contributions
        const sortedNutrients = Object.entries(contributions)
            .sort(([,a], [,b]) => getPercentageOfConstraint(b, a) - getPercentageOfConstraint(a, b))
            .slice(0, 5);
        
        for (const [nutrient, value] of sortedNutrients) {
            const percentage = getPercentageOfConstraint(value, nutrient);
            const formattedValue = Math.round(value * 100) / 100;
            const unit = nutrient.match(/\((.*?)\)/)?.[1] || '';
            
            detailsHTML += `
                <div class="nutrient-item">
                    <div class="nutrient-item-header">
                        <span>${nutrient.replace(/\s*\([^)]*\)/, '')}</span>
                        <span>${formattedValue} ${unit}</span>
                    </div>
                    <div class="nutrient-bar">
                        <div class="nutrient-bar-fill" style="width: ${Math.min(100, percentage)}%"></div>
                    </div>
                </div>
            `;
        }
        
        detailsHTML += '</div>';
        detailsContainer.innerHTML = detailsHTML;
    }
}

function displayFoodList() {
    if (!isDataLoaded) {
        document.getElementById('checkbox-filter').innerHTML = "<p>Loading data...</p>";
        return;
    }
    
    let html = '<div class="food-list">';
    
    // Sort food items: enabled foods first, then disabled foods
    const sortedFoods = Object.keys(data).sort((a, b) => {
        const aEnabled = enabledFoods.has(a);
        const bEnabled = enabledFoods.has(b);
        if (aEnabled === bEnabled) {
            return a.localeCompare(b); // If both enabled or both disabled, sort alphabetically
        }
        return aEnabled ? -1 : 1; // Enabled foods come first
    });
    
    for (let foodName of sortedFoods) {
        const isEnabled = enabledFoods.has(foodName);
        html += `
            <div class='food-item ${!isEnabled ? 'disabled' : ''}' data-food-name="${foodName}" onclick="toggleFoodDetails('${foodName.replace(/'/g, "\\'")}')">
                <div class="food-item-header">
                    <div class="food-item-info">
                        <h3>${foodName}</h3>
                        <p style='color: var(--text-secondary);'>
                            ${data[foodName]["Public Food Key"] || 'No ID'}
                        </p>
                    </div>
                    <label class="toggle-switch" onclick="event.stopPropagation()">
                        <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleFood('${foodName.replace(/'/g, "\\'")}')">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="food-item-details">
                    <!-- Nutritional details will be populated when expanded -->
                </div>
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