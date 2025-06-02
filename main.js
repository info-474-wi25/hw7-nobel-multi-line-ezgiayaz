// 1: SET GLOBAL VARIABLES
const margin = { top: 50, right: 30, bottom: 60, left: 70 },
      width = 750 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

const svgLine = d3.select("#lineChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// 2: LOAD DATA
d3.csv("nobel_laureates.csv").then(data => {
    data.forEach(d => {
        d["year"] = +d["year"];  // Parse year
        d["name"] = d["fullname"]; // Rename column
    });

    // 3: PREPARE DATA
    const stemCategories = ["chemistry", "physics", "medicine"];
    const categorizedData = data.map(d => ({
        ...d, 
        categoryGroup: stemCategories.includes(d.category) ? "STEM" : "Non-STEM"
    }));

    const categories = d3.rollup(categorizedData, 
        v => d3.rollup(v, 
                values => values.length, // Count laureates in each year
                d => d.year // Group by year
            ),
        d => d.categoryGroup // Group by STEM/Non-STEM
    );

    // 4: SET SCALES
    const allYears = Array.from(categories.values())
        .flatMap(yearMap => Array.from(yearMap.keys()));
    const yearCounts = Array.from(categories.values())
        .map(categoryMap => Array.from(categoryMap.values()));
    const maxCount = d3.max(yearCounts, yearValues => d3.max(yearValues));

    const xScale = d3.scaleLinear()
        .domain(d3.extent(allYears))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, maxCount + 1])
        .range([height, 0]);

    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.count));

    // Flattened Data for use in dropdown and update function
    const flattenedData = [];
    categories.forEach((yearMap, category) => {
        yearMap.forEach((count, year) => {
            flattenedData.push({ year, count, category });
        });
    });

    // Filter to just STEM
    filteredFlattenedData = flattenedData.filter(d => d.category === "STEM");

    // 5: PLOT LINES
    svgLine.selectAll("path.data-line")
            .data([filteredFlattenedData])
            .enter()
            .append("path")
            .attr("class", "data-line")
            .attr("d", d3.line()
                .x(d => xScale(d.year))
                .y(d => yScale(d.count))
            )
            .style("stroke", "steelblue")
            .style("fill", "none")
            .style("stroke-width", 2);

    // 6: ADD AXES
    svgLine.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
        .attr("class", "x-axis");

    svgLine.append("g")
        .call(d3.axisLeft(yScale))
        .attr("class", "y-axis");

    // 7: ADD LABELS
    svgLine.append("text")
        .attr("class", "title")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .text("Nobel Laureates Trends")
        .style("font-size", "16px")
        .style("font-weight", "bold");

    svgLine.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Year");

    svgLine.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .text("Number of Laureates");

    // --- INTERACTIVITY ---
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "rgba(0, 0, 0, 0.7)")
        .style("color", "white")
        .style("padding", "10px")
        .style("border-radius", "5px")
        .style("font-size", "12px");

    svgLine.selectAll(".data-point")
        .data(filteredFlattenedData)
        .enter()
        .append("circle")
        .attr("class", "data-point")
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.count))
        .attr("r", 5)
        .style("fill", "steelblue")
        .style("opacity", 0)
        .on("mouseover", function(event, d) {
            tooltip.style("visibility", "visible")
                .html(`<strong>Year:</strong> ${d.year} <br><strong>Laureates:</strong> ${d.count}`)
                .style("top", (event.pageY + 10) + "px")
                .style("left", (event.pageX + 10) + "px");

            d3.select(this).style("opacity", 1);

            svgLine.append("circle")
                .attr("class", "hover-circle")
                .attr("cx", xScale(d.year))
                .attr("cy", yScale(d.count))
                .attr("r", 6)
                .style("fill", "steelblue")
                .style("stroke-width", 2);
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY + 10) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
            svgLine.selectAll(".hover-circle").remove();
            d3.select(this).style("opacity", 0);
        });

    function linearRegression(data) {
        const n = data.length;
        const sumX = d3.sum(data, d => d.year);
        const sumY = d3.sum(data, d => d.count);
        const sumXY = d3.sum(data, d => d.year * d.count);
        const sumX2 = d3.sum(data, d => d.year * d.year);

        const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const b = (sumY - m * sumX) / n;

        return data.map(d => ({
            year: d.year,
            count: m * d.year + b
        }));
    }

    function drawTrendline(selectedCategory) {
        const filteredData = flattenedData.filter(d => d.category === selectedCategory);
        const trendlineData = linearRegression(filteredData);

        svgLine.selectAll(".trendline").remove();

        svgLine.append("path")
            .data([trendlineData])
            .attr("class", "trendline")
            .attr("d", d3.line()
                .x(d => xScale(d.year))
                .y(d => yScale(d.count)))
            .attr("fill", "none")
            .attr("stroke", "gray")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5");
    }

    function updateChart(selectedGroup) {
        const dataFilter = flattenedData.filter(d => d.category === selectedGroup);

        svgLine.selectAll("path.data-line").remove();
        svgLine.selectAll(".trendline").remove();

        const groupedData = Array.from(
            d3.group(dataFilter, d => d.year),
            ([year, values]) => ({
                year,
                count: d3.sum(values, d => d.count)
            })
        );

        svgLine.selectAll("path.data-line")
            .data([groupedData])
            .enter()
            .append("path")
            .attr("class", "data-line")
            .attr("d", d3.line()
                .x(d => xScale(d.year))
                .y(d => yScale(d.count)))
            .style("stroke", "steelblue")
            .style("fill", "none")
            .style("stroke-width", 2);

        if (d3.select("#trendline-toggle").property("checked")) {
            drawTrendline(selectedGroup);
        }
    }

    updateChart("STEM");

    d3.select("#trendline-toggle").on("change", function() {
        const isChecked = d3.select(this).property("checked");
        const selectedCategory = d3.select("#categorySelect").property("value");

        if (isChecked) {
            drawTrendline(selectedCategory);
        } else {
            svgLine.selectAll(".trendline").remove();
        }
    });

    d3.select("#categorySelect").on("change", function() {
        const selectedCategory = d3.select(this).property("value");
        updateChart(selectedCategory);
    });
});
