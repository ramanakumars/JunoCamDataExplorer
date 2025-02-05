import React from "react";
import Plot from "react-plotly.js";
import MainNav from "../util/Nav.js";
import SubjectImage from "../subject/SubjectImage.js";
import MultiRangeSlider from "multi-range-slider-react";
import LoadingPage from "../util/LoadingPage.js";

const var_names = {
    hist: ["x"],
    scatter: ["x", "y"],
};

const blue = "#2e86c1";
const red = "#922b21";
const plotly_type = {'hist': 'histogram', 'scatter': 'scattergl'};

class Explorer extends React.Component {
    /*
     * Main explorer app. Creates the forms for choosing plot type and variables
     * and also the subsequent display for the plot and the subject images
     */
    constructor(props) {
        super(props);

		this.state = {
			'variables': []
		};

        // create references for the child components
        this.choose_plot_form = React.createRef();
        this.create_plot_form = React.createRef();
        this.subject_plotter = React.createRef();
        this.subset_PJ = React.createRef();
        this.vortex_selector = React.createRef();

        // handleSubmit will handle the "Plot!" click button
        this.handleSubmit = this.handleSubmit.bind(this);

        // filter will handle the slider for perijove filtering and
        // "vortex only" selection
        this.filter = this.filter.bind(this);
    }

	componentDidMount() {
		this.refreshData();
	}

	refreshData() {
        fetch("/backend/get-exploration-data/", {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        }).then((result) => result.json()).then((data) => {
			// get the subject metadata and the list of variables
			// from the backend API
			this.subject_plotter.current.setState({
				'subject_data': data.subject_data,
				'variables': data.variables
			});
			this.setState({
				'variables': data.variables
			});
			this.choose_plot_form.current.setState({
				'variables': data.variables
			});
		});
		
	}

    handleSubmit(event) {
        /*
         * handles the "Plot!" click by fetching the relevant
         * data from the child component forms
         * and sending to the backend API to retrieve the subject metadata
         * (i.e. lat, lon, PJ, ID, url, etc.)
         */
        event.preventDefault();

        // start building the data structure to send to the backend
        var plot_type = this.choose_plot_form.current.state.chosen;

        const chosen_vars = var_names[plot_type];

        // get a list of chosen variables from the form elements
		var plot_variables = {};
        for (var i = 0; i < chosen_vars.length; i++) {
            if (event.target.elements[chosen_vars[i]].value === "") {
                return;
            }
            plot_variables[chosen_vars[i]] = event.target.elements[chosen_vars[i]].value;
        }

		var layout = {};
		layout["hovermode"] = "closest";
		layout["width"] = 1200;
		layout["height"] = 600;

		if (plot_type === "hist") {
			layout["xaxis"] = {"title": plot_variables['x']}
		} else if (plot_type === "scatter") {
			layout["xaxis"] = {"title": plot_variables['x']}
			layout["yaxis"] = {"title": plot_variables['y']}
		}

        // send to the backend
		this.subject_plotter.current.set_data(
			plot_variables,
			layout,
			plot_type,
			this.subset_PJ.current.state.minValue,
			this.subset_PJ.current.state.maxValue,
			this.vortex_selector.current.state.checked
		);
    }

    filter(event) {
        /*
         * handles the perijove slider for filtering the displayed data
         */

        // this is handled mainly by the plotter component since that is where
        // the data is stored
        this.subject_plotter.current.filter(
            this.subset_PJ.current.state.minValue,
            this.subset_PJ.current.state.maxValue,
            this.vortex_selector.current.state.checked
        );
    }

    render() {
        document.title = "JuDE explorer";
        return (
            <article id="main">
                <MainNav target="explore" />
                <section id="app">
                    <section id="plot-info">
                        <ChoosePlotType
                            ref={this.choose_plot_form}
							variables={this.state.variables}
                            onSubmit={this.handleSubmit}
                        />
                        <SubsetPJ ref={this.subset_PJ} onChange={this.filter} />
                        <VortexSelector ref={this.vortex_selector} onChange={this.filter} />
                    </section>
                    <PlotContainer ref={this.subject_plotter} />
                </section>
            </article>
        );
    }
}

class PlotContainer extends React.Component {
    /*
     * Main display component for the Plotly plots and the subject images
     * also handles the data distribution between the plotly components
     * and the subject image display
     */

    constructor(props) {
        super(props);

        // create links to child components for plotting the
        // subject images and the plotly component
        this.subject_images = React.createRef();
        this.subject_plotter = React.createRef();
        this.hover_images = React.createRef();

        // create handlers for hovering over/selecting the plotly data
        this.handleHover = this.handleHover.bind(this);
        this.handleSelect = this.handleSelect.bind(this);
    }

    set_data(plot_variables, layout, plot_type, PJstart, PJend, vortex_only) {
        /*
         * main function for setting the data received from the backend
         * immediately calls `filter_PJ` which calls the
         * `set_plot_data` to set the plotly data
         */

		var data = {}
		if(plot_type === "hist") {
			var metadata_key = plot_variables['x']

			var values = this.state.subject_data.map((data) => (
				data[metadata_key]
			));

			var binstart = 0;
			var binend = 0;
			var binwidth = 0;
			var nbins = 0;
			if(metadata_key === "latitude") {
				binstart = -70;
				binend = 70;
				binwidth = 5;
				nbins = 28;
			} else if (metadata_key === "longitude") {
				binstart = -180;
				binend = 180;
				binwidth = 10;
				nbins = 36;
			} else if (metadata_key === "perijove") {
				binstart = 13;
				binend = 36;
				binwidth = 1;
				nbins = 24;
			}

			data = {'x': values, 'type': plotly_type[plot_type],
				'xbins': {'start': binstart, 'end': binend, 'size': binwidth},
				'nbinsx': nbins, 
				'marker': {'color': Array(nbins).fill('#2e86c1') }
			};
		} else if (plot_type === "scatter") {
			var data_x = this.state.subject_data.map((data) => (
				data[plot_variables['x']]));
			var data_y = this.state.subject_data.map((data) => (
				data[plot_variables['y']]));
			
			data = {'x': data_x, 'y': data_y, 'mode': 'markers',
				'type': plotly_type[plot_type],
				'marker': {'color': Array(data_x.length).fill("dodgerblue")}
			};
		}

        this.setState(
            {
                data: data,
                layout: layout,
                plot_name: plot_type,
            },
            function () {
                this.filter(PJstart, PJend, vortex_only);
            }
        );
    }

    set_plot_data(data, subject_data) {
        /*
         * sets the relevant data to the plotly component and subject image
         * display for plotting purposes
         * by default is called when the backend receives data from clicking
         * "Plot!"
         */

        // set the data for the main set of subject images at the bottom
        this.subject_images.current.setState({ subject_data: subject_data });

        // set the data for the images on hover on the right
        // by default only sets the first element of the subject list
        this.hover_images.current.setState({ subject_data: [subject_data[0]] });

        // set the data for the plotly component
        this.subject_plotter.current.setState({
            data: [data],
            layout: this.state.layout,
            subject_data: subject_data,
            plot_name: this.state.plot_name,
        });
    }

    filter(start, end, vortex_only) {
        /*
         * filters the range of perijoves displayed
         * called after plotting and also when the PJ slider is changed
         */
        var data = {};
        var subject_data = [];

        if (this.state === null) {
            return null;
        }

        // duplicate the plotly structure
        for (var key in this.state.data) {
            if (key !== "x" || key !== "y") {
                data[key] = this.state.data[key];
            }
        }

        data.marker.color = new Array(data.marker.color.length).fill(blue);

        // create the same set of variables as the original plot
        data.x = [];
        if ("y" in this.state.data) {
            data.y = [];
        }

        // copy over the data for the given perijove range
        for (var i = 0; i < this.state.subject_data.length; i++) {
            if (vortex_only & !this.state.subject_data[i].is_vortex) {
                continue;
            }

            if (
                (this.state.subject_data[i].perijove >= start) &
                (this.state.subject_data[i].perijove <= end)
            ) {
                data.x.push(this.state.data.x[i]);
                subject_data.push(this.state.subject_data[i]);

                if ("y" in this.state.data) {
                    data.y.push(this.state.data.y[i]);
                }
            }
        }

        // refresh the plot
        this.set_plot_data(data, subject_data);
    }

    handleHover(data) {
        /*
         * function that handles the change of the hover image panel when
         * hovering over the plotly component
         */
        this.hover_images.current.setState({ subject_data: data, page: 0 });
    }

    handleSelect(data) {
        /*
         * function that handles the change of the selection image panel when
         * lasso or box selecting data in the plotly component
         */
        this.subject_images.current.setState({ subject_data: data, page: 0 });
    }

    render() {
        return (
            <section id="plotter">
                <section id="plot-container">
                    <SubjectPlotter
                        ref={this.subject_plotter}
                        variables={[]}
                        data={null}
                        layout={null}
                        subject_data={[]}
                        handleHover={this.handleHover}
                        handleSelect={this.handleSelect}
                    />
                </section>
                <section id="images-container">
                    <SubjectImages
                        variables={[]}
                        render_type={"selection"}
                        subject_data={[]}
                        ref={this.subject_images}
                    />
                    <SubjectImages
                        variables={[]}
                        render_type={"hover"}
                        subject_data={[]}
                        ref={this.hover_images}
                    />
                </section>
            </section>
        );
    }
}

class ChoosePlotType extends React.Component {
    /*
     * Form for choosing the type of plot (currently Histogram and Scatter)
     * will automatically create the subsequent form to choose the required variables
     */
    constructor(props) {
        super(props);
        this.state = {
            variables: props.variables,
            chosen: "hist",
        };

        this.variable_form = React.createRef();

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleChange(event) {
        var plot_type = event.target.id;
        this.setState({ chosen: plot_type });
    }

    handleSubmit(event) {
        this.props.onSubmit(event);
    }

    render() {
        return (
            <section id="choose-plot-container">
                <section id="plot-header">
                    <h1>Choose the plot type</h1>
                    <nav id="plot-type">
                        <span>
                            <input
                                type="radio"
                                name="plot-type"
                                className="plot-type"
                                id="hist"
                                onChange={this.handleChange}
                                defaultChecked
                            />
                            <label htmlFor="hist" className="radio plot-type">
                                Histogram
                            </label>
                        </span>
                        <span>
                            <input
                                type="radio"
                                name="plot-type"
                                className="plot-type"
                                id="scatter"
                                onChange={this.handleChange}
                            />
                            <label htmlFor="scatter" className="radio plot-type">
                                Scatter plot
                            </label>
                        </span>
                    </nav>
                </section>
                <section id="variable-picker">
                    <CreatePlotForm
                        variables={this.state.variables}
                        key={this.state.chosen + this.state.variables}
                        plot_name={this.state.chosen}
                        var_names={var_names[this.state.chosen]}
                        ref={this.variable_form}
                        onSubmit={this.handleSubmit}
                    />
                </section>
            </section>
        );
    }
}

class CreatePlotForm extends React.Component {
    constructor(props) {
        super(props);
        // this.state = {};
        this.state = {
            variables: props.variables,
            n_vars: props.var_names.length,
            var_names: props.var_names,
            plot_name: props.plot_name,
        };

        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleSubmit(event) {
        event.preventDefault();

        this.props.onSubmit(event);
    }
    render() {
        var var_selects = [];
        var variables = [];

        for (var i = 0; i < this.state.n_vars; i++) {
            var_selects.push({ name: this.state.var_names[i] });
        }

        for (var key in this.state.variables) {
            variables.push({ name: key, variable: this.state.variables[key] });
        }

        return (
            <div
                id="hist-variable"
                className="variable-picker-container"
                key={"var_container"}
            >
                <form
                    id="hist-variables"
                    className="plot-variable"
                    onSubmit={this.handleSubmit}
                    key={"var_form"}
                >
                    {var_selects.map((vx) => (
                        <span key={vx.name + "_span"}>
                            <label htmlFor={vx.name} key={vx.name + "_label"}>
                                {vx.name}:{" "}
                            </label>
                            <select
                                name={vx.name}
                                id={vx.name}
                                defaultValue=""
                                className="variable-select"
                                key={vx.name + "_select"}
                            >
                                <option value="" disabled key={vx.name + "_default"}>
                                    Choose a variable
                                </option>
                                {variables.map((vi) => (
                                    <option
                                        value={vi.variable}
                                        key={vx.name + vi.name + "_label"}
                                    >
                                        {vi.variable}
                                    </option>
                                ))}
                            </select>
                        </span>
                    ))}
                    <input
                        type="submit"
                        value="Plot!"
                        key={this.state.subject_set_id + "_var_submit"}
                    />
                </form>
            </div>
        );
    }
}

class SubsetPJ extends React.Component {
    constructor(props) {
        super(props);
        this.state = { minValue: 13, maxValue: 36 };
    }

    handleInput(e) {
        this.setState({ maxValue: e.maxValue, minValue: e.minValue });

        this.props.onChange(e);
    }

    render() {
        return (
            <div id="filter-pj">
                <label>Filter by perijove</label>
                <MultiRangeSlider
                    min={13}
                    max={36}
                    step={1}
                    ruler={false}
                    label={true}
                    preventWheel={false}
                    minValue={this.state.minValue}
                    maxValue={this.state.maxValue}
                    onInput={(e) => {
                        this.handleInput(e);
                    }}
                />
            </div>
        );
    }
}

class VortexSelector extends React.Component {
    constructor(props) {
        super(props);
        this.state = { checked: true };

        this.handleInput = this.handleInput.bind(this);
    }

    handleInput(e) {
        this.setState({ checked: !this.state.checked }, function () {
            this.props.onChange(e);
        });
    }

    render() {
        return (
            <div id="vortex_checkbox">
                <input
                    type="checkbox"
                    name="vortex_only"
                    id="vortex_only"
                    onChange={this.handleInput}
                    checked={this.state.checked}
                />
                <label htmlFor="vortex_only">Show vortices only </label>
            </div>
        );
    }
}

class SubjectPlotter extends React.Component {
    constructor(props) {
        super(props);
        // this.state = {};
        this.state = {
            data: props.data,
            layout: props.layout,
            n_vars: props.variables.length,
            subject_data: props.subject_data,
            plot_name: props.plot_name,
        };

        this.handleHover = this.handleHover.bind(this);
        this.handleSelect = this.handleSelect.bind(this);
        this.resetSelection = this.resetSelection.bind(this);
        this.plot = React.createRef();
    }

    handleHover(event_data) {
        var data = [];
		var colors = [];
        if (this.state.plot_name === "hist") {
            var binNumber = [];
            for (var i = 0; i < event_data.points[0].pointNumbers.length; i++) {
                data.push(this.state.subject_data[event_data.points[0].pointNumbers[i]]);
                binNumber.push(event_data.points[0].binNumber);
            }

            binNumber = [...new Set(binNumber)];

            // change the bin corresponding to the hover data
            colors = new Array(this.state.data[0].marker.color.length).fill(blue);
            for (i = 0; i < binNumber.length; i++) {
                colors[binNumber[i]] = red;
            }
        } else if (this.state.plot_name === "scatter") {
            colors = new Array(this.state.data[0].x.length).fill(blue);
            for (i = 0; i < event_data.points.length; i++) {
                data.push(this.state.subject_data[event_data.points[i].pointNumber]);
                colors[event_data.points[i].pointNumber] = red;
            }
        }

        var state_data = this.state.data[0];
        state_data.marker.color = colors;
        this.setState({ data: [state_data] });

        this.props.handleHover(data);
    }

    handleSelect(event_data) {
        if (event_data === undefined) {
            return;
        }

        var data = [];
        if (this.state.plot_name === "hist") {
            for (var j = 0; j < event_data.points.length; j++) {
                for (var i = 0; i < event_data.points[j].pointNumbers.length; i++) {
                    data.push(this.state.subject_data[event_data.points[0].pointNumbers[i]]);
                }
            }
        } else if (this.state.plot_name === "scatter") {
            for (i = 0; i < event_data.points.length; i++) {
                data.push(this.state.subject_data[event_data.points[i].pointNumber]);
            }
        }

        this.props.handleSelect(data);
    }

    resetSelection() {
        var data = [];
        if (this.state.plot_name === "hist") {
            for (var i = 0; i < this.state.subject_data.length; i++) {
                data.push(this.state.subject_data[i]);
            }
        } else if (this.state.plot_name === "scatter") {
            for (i = 0; i < this.state.subject_data.length; i++) {
                data.push(this.state.subject_data[i]);
            }
        }

        this.props.handleSelect(data);
    }

    render() {
        if (this.state.data != null) {
            return (
                <div id="plot">
                    <Plot
                        ref={this.plot}
                        data={this.state.data}
                        layout={this.state.layout}
                        onHover={this.handleHover}
                        onSelected={this.handleSelect}
                        onDeselect={this.resetSelection}
                    />
                </div>
            );
        } else {
            return <div id="plot"></div>;
        }
    }
}

class SubjectImages extends React.Component {
    constructor(props) {
        super(props);
        // this.state = {};
        var nmax = 16;

        this.state = {
            variables: props.variables,
            n_vars: props.variables.length,
            subject_data: props.subject_data,
            render_type: props.render_type,
            page: 0,
            nimages: nmax
        };

        this.prevPage = this.prevPage.bind(this);
        this.nextPage = this.nextPage.bind(this);
        this.getExport = this.getExport.bind(this);

        this.loading_page = React.createRef();
    }

    prevPage(e) {
        e.preventDefault();
        e.stopPropagation();
        if (this.state.page > 0) {
            this.setState({ page: this.state.page - 1 });
        }

        return false;
    }

    nextPage(e) {
        e.preventDefault();
        e.stopPropagation();
        if (this.state.page < this.npages - 1) {
            this.setState({ page: this.state.page + 1 });
        }
        return false;
    }

    getExport(e) {
		var postdata = { subject_IDs: this.state.subject_data.map((data) => data.subject_ID) };

        this.loading_page.current.enable();

        // send to the backend
        fetch("/backend/create-export/", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            // the input/output are in JSON format
            body: JSON.stringify(postdata),
        })
            .then((result) => result.json())
            .then((data) => {
                if (!data.error) {
                    // create a link holding the file download
                    const element = document.createElement("a");

                    // save the file blob
                    const file = new Blob([data.filedata], {
                        type: "text/csv",
                    });

                    // save the link attributes
                    element.href = URL.createObjectURL(file);
                    element.download = "subject_export.csv";

                    // append to body (for Firefox)
                    document.body.appendChild(element);

                    // click on the link to download the file
                    element.click();

                    // cleanup
                    element.remove();
                    this.loading_page.current.disable();
                } else {
                }
            });
    }

    render() {
        if (this.state.subject_data == null) {
            return null;
        }

		this.npages = Math.ceil(this.state.subject_data.length / this.state.nimages);

        var subject_data = [];

        const startind = this.state.page * this.state.nimages;

        for (
            var i = startind;
            i < Math.min(this.state.subject_data.length, startind + this.state.nimages);
            i++
        ) {
            subject_data.push({
                idx: i,
                url: this.state.subject_data[i].url,
                subject_ID: this.state.subject_data[i].subject_ID,
                longitude: this.state.subject_data[i].longitude,
                latitude: this.state.subject_data[i].latitude,
                perijove: this.state.subject_data[i].perijove
            });
        }

        var style = {};

        if (this.state.subject_data.length < 1) {
            return null;
        }

        var rand_key = Math.random();

        return (
            <div
                key={rand_key}
                className={
                    "subject-images-container subject-images-container-" +
                    this.state.render_type
                }
            >
                <div className="image-page">
                    <button onClick={this.prevPage}>&laquo;</button>
                    {this.state.page + 1} / {this.npages}
                    <button onClick={this.nextPage}>&raquo;</button>
                </div>
                {subject_data.map(data => (
                    <SubjectImage
                        key={data.subject_ID + "_" + this.state.render_type}
                        url={data.url}
						metadata={data}
                        style={style}
                    />
                ))}

                <div className="subject-export-container">
                    <button onClick={this.getExport}>Export subjects</button>
                </div>
                <LoadingPage ref={this.loading_page} enable={false} />
            </div>
        );
    }
}

export default Explorer;
