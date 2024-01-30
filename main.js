
const constraints = {
    "Vitamin C (mg)": {
        min: 45
    },
    "Vitamin A retinol equivalents (ug)": {
        min: 900
    },
    "Protein (g)": {
        min: 64
    },
    "Zinc (Zn) (mg)": {
        min: 14,
        max: 40
    },
    "Vitamin E (mg)": {
        max: 300
    },
    "Vitamin D3 equivalents (ug)": {
        max: 80
    },
    "Thiamin (B1) (mg)": {
        min: 1.2
    },
    "Selenium (Se) (ug)": {
        min: 70,
        max: 400
    },
    "Riboflavin (B2) (mg)": {
        min: 1.1
    },
    "Phosphorus (P) (mg)": {
        min: 1000,
        max: 4000
    },
    "Molybdenum (Mo) (ug)": {
        min: 45,
        max: 2000
    },
    "Magnesium (Mg) (mg)": {
        min: 400
    },
    "Iron (Fe) (mg)": {
        min: 8,
        max: 45
    },
    "Iodine (I) (ug)": {
        min: 150,
        max: 1100
    },
    "Dietary folate equivalents (ug)": {
        min: 400,
        max: 1000
    },
    "Copper (Cu) (mg)": {
        max: 10
    },
    "Copper (Cu) (mg)": {
        max: 10
    },
    "Total dietary fibre (g)": {
        min: 30
    },
    "Sodium (Na) (mg)": {
        min: 460,
        max: 2300
    },
    "grams": {
        max: 1000
    }
}

var data = {test: "test"};

class ExcelToJSON {
    constructor() {
        this.parseExcel = function (file) {
            var reader = new FileReader();

            reader.onload = function (e) {
                var data = e.target.result;
                var workbook = XLSX.read(data, {
                    type: 'binary'
                });

                workbook.SheetNames.forEach(
                    function (sheetName) {
                        console.log(sheetName);
                    }
                );

                var json_object = XLSX.utils.sheet_to_json(workbook.Sheets["All solids &amp; liquids per 100g"])
                console.log(json_object);

                // const lp = new jsLPSolver();

                var res = {};

                Object.keys(json_object).forEach(key => {
                    res[key] = {};
                    Object.keys(json_object[key]).forEach(temp => {
                        res[key][temp.replace(/(\r\n|\n|\r)/gm, "").replace("&#10;", "")] = !isNaN(json_object[key][temp])
                            ? Number(json_object[key][temp], 10)/100
                            : json_object[key][temp];
                    });
                    return res;
                });

                console.log(res)

                var objects = {}

                for (var key in res) {
                    // console.log(res[key])
                    objects[res[key]["Food Name"]] = res[key]
                }
                // for (let index = 0; index < res.length; index++) {
                //     const element = res[index];
                //     objects[element["Food Name"]] = element
                // }

                console.log("objectssss")
                console.log(objects)

                data = objects;

                const model = {
                    optimize: "grams",
                    opType: "min",
                    constraints: constraints,
                    variables: objects,
                    options: {
                        tolerance: 0.1 // 10% margin of tolerance for the values
                    }
                };

                // We don't need to declare 'solver', it is already exported via the script we load
                const results = solver.Solve(model); // Note the capital '.Solve'
                console.log("Results", results);
            };

            reader.onerror = function (ex) {
                console.log(ex);
            };

            reader.readAsBinaryString(file);
        };
    }
}

function solve(){
    const model = {
        optimize: "grams",
        opType: "min",
        constraints: constraints,
        variables: data,
        options: {
            tolerance: 0.1 // 10% margin of tolerance for the values
        }
    };

    // We don't need to declare 'solver', it is already exported via the script we load
    const results = solver.Solve(model); // Note the capital '.Solve'
    console.log("Results", results);
    document.getElementById('result').textContent = results;
}

function fun() {
    console.log("fun")
    document.getElementById("result").innerHTML = "The function fun() is triggered !";
    blah = new ExcelToJSON();
    // url="https://www.foodstandards.gov.au/sites/default/files/2023-11/Release%202%20-%20Nutrient%20file.xlsx"
    url = "./nutrient-file2.xlsx"
    fetch(url)
        .then(response => response.blob()) // Get the file as a Blob object
        .then(blob => {
            // Create a temporary File object to pass to the parseExcel function
            const file = new File([blob], 'temp.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            blah.parseExcel(file);
        })
        .catch(error => console.error('Error fetching file:', error));
}

// then this function only shows filtered users
function init() {
    console.log(data);

    let html = '<h2>Checkbox</h2>';
  
    data.forEach(data => {
      html += `
                  <ul class = "mylist card">
                      <li id = "myli" class = "card-body text-primary pl-3"> ${data["Food Name"]} </li>
                      <li class = "card-body text-secondary"> ${data["Public Food Key"]} </li>
                  </ul>
              `;
    });
  
   document.getElementById('checkbox-filter').innerHTML = html;
}

document.addEventListener("DOMContentLoaded", function(event) {
    // Your code to run since DOM is loaded and ready
    console.log("JS started")
    fun();
    init();
});