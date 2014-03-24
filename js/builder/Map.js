define(["vis/scaffold", "lib/d3", "builder/draw"], function(scaffold, d3, draw) {
    /**
     */

    var Map = scaffold.make_class();
    Map.prototype = { init: init,
		      select_metabolite: select_metabolite };

    return Map;

    function init() {
	this.drawn_nodes = [];
	this.drawn_reactions = [];
    };

    function select_metabolite() {
    };

    // ---------------------------------------------------------------------
    // Drawing

    function has_flux() {
	return Boolean(o.flux);
    }
    function has_node_data() {
	return Boolean(o.node_data);
    };
    function draw_everything() {
	draw.draw(o.drawn_membranes, o.drawn_reactions, o.drawn_nodes,
		  o.drawn_text_labels, o.scale, o.show_beziers,
		  o.reaction_arrow_displacement, o.defs, o.arrowheads_generated,
		  o.default_reaction_color, has_flux(), has_node_data(),
		  o.node_data_style, o.behavior.node_click,
		  o.behavior.node_drag, o.behavior.bezier_drag);
    }
    function draw_these_reactions(reaction_ids) {
	draw.draw_specific_reactions(reaction_ids, o.drawn_reactions, o.drawn_nodes,
				     o.scale, o.show_beziers,
				     o.reaction_arrow_displacement, o.defs,
				     o.arrowheads_generated, o.default_reaction_color,
				     has_flux(), o.behavior.node_drag);
    }
    function draw_these_nodes(node_ids) {
	draw.draw_specific_nodes(node_ids, o.drawn_nodes, o.drawn_reactions, o.scale,
				 has_node_data(), o.node_data_style,
				 o.behavior.node_click, o.behavior.node_drag);
    }
    function apply_flux_to_map() {
	apply_flux_to_reactions(o.drawn_reactions);
    }
    function apply_flux_to_reactions(reactions) {
	for (var reaction_id in reactions) {
	    var reaction = reactions[reaction_id];
	    if (reaction.abbreviation in o.flux) {
		var flux = parseFloat(o.flux[reaction.abbreviation]);
		reaction.flux = flux;
		for (var segment_id in reaction.segments) {
		    var segment = reaction.segments[segment_id];
		    segment.flux = flux;
		}
	    } else {
		var flux = 0.0;
		reaction.flux = flux;
		for (var segment_id in reaction.segments) {
		    var segment = reaction.segments[segment_id];
		    segment.flux = flux;
		}
	    }
	}
    }
    function apply_node_data_to_map() {
	apply_node_data_to_nodes(o.drawn_nodes);
    }
    function apply_node_data_to_nodes(nodes) {
	var vals = [];
	for (var node_id in nodes) {
	    var node = nodes[node_id], data = 0.0;
	    if (node.bigg_id_compartmentalized in o.node_data) {
		data = parseFloat(o.node_data[node.bigg_id_compartmentalized]);
	    }
	    vals.push(data);
	    node.data = data;
	}
	var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
	o.scale.node_size.domain([min, max]);
	o.scale.node_color.domain([min, max]);
    }

    // ---------------------------------------------------------------------
    // Node interaction
    
    function get_coords_for_node(node_id) {
        var node = o.drawn_nodes[node_id],
            coords = {'x': node.x, 'y': node.y};
        return coords;
    }
    function get_selected_node_ids() {
	var selected_node_ids = [];
	d3.select('#nodes')
	    .selectAll('.selected')
	    .each(function(d) { selected_node_ids.push(d.node_id); });
	return selected_node_ids;
    }
    function get_selected_nodes() {
	var selected_nodes = {};
	d3.select('#nodes')
	    .selectAll('.selected')
	    .each(function(d) { selected_nodes[d.node_id] = o.drawn_nodes[d.node_id]; });
	return selected_nodes;
    }	
    function select_metabolite_with_id(node_id) {
	var node_selection = o.sel.select('#nodes').selectAll('.node'),
	    coords;
	node_selection.classed("selected", function(d) {
	    var selected = String(d.node_id) == String(node_id);
	    if (selected)
		coords = { x: o.scale.x(d.x), y: o.scale.y(d.y) };
	    return selected;
	});
	if (input.is_visible(o.reaction_input)) cmd_show_input();
	o.direction_arrow.set_location(coords);
	o.direction_arrow.show();
	o.sel.selectAll('.start-reaction-target').style('visibility', 'hidden');
    }
    function select_metabolite(sel, d) {
	var node_selection = o.sel.select('#nodes').selectAll('.node'), 
	    shift_key_on = o.shift_key_on;
	if (shift_key_on) d3.select(sel.parentNode)
	    .classed("selected", !d3.select(sel.parentNode).classed("selected"));
        else node_selection.classed("selected", function(p) { return d === p; });
	var selected_nodes = d3.select('.selected'),
	    count = 0,
	    coords;
	selected_nodes.each(function(d) {
	    coords = { x: o.scale.x(d.x), y: o.scale.y(d.y) };
	    count++;
	});
	if (count == 1) {
	    if (input.is_visible(o.reaction_input)) {
		cmd_show_input();
	    } else {
		cmd_hide_input();
	    }
	    o.direction_arrow.set_location(coords);
	    o.direction_arrow.show();
	} else {
	    cmd_hide_input();
	    o.direction_arrow.hide();
	}
	o.sel.selectAll('.start-reaction-target').style('visibility', 'hidden');
    }

    // ---------------------------------------------------------------------
    // Building

    function new_reaction_from_scratch(starting_reaction, coords) {
	/** Draw a reaction on a blank canvas.

	 starting_reaction: bigg_id for a reaction to draw.
	 coords: coordinates to start drawing

	 */
	
        // If reaction id is not new, then return:
	for (var reaction_id in o.drawn_reactions) {
	    if (o.drawn_reactions[reaction_id].abbreviation == starting_reaction) {             
		console.warn('reaction is already drawn');
                return;
	    }
        }

        // set reaction coordinates and angle
        // be sure to copy the reaction recursively
        var cobra_reaction = utils.clone(o.cobra_reactions[starting_reaction]);

	// create the first node
	for (var metabolite_id in cobra_reaction.metabolites) {
	    var metabolite = cobra_reaction.metabolites[metabolite_id];
	    if (metabolite.coefficient < 0) {
		var selected_node_id = ++o.map_info.largest_ids.nodes,
		    label_d = { x: 30, y: 10 },
		    selected_node = { connected_segments: [],
				      x: coords.x,
				      y: coords.y,
				      node_is_primary: true,
				      compartment_name: metabolite.compartment,
				      label_x: coords.x + label_d.x,
				      label_y: coords.y + label_d.y,
				      metabolite_name: metabolite.name,
				      bigg_id: metabolite.bigg_id,
				      bigg_id_compartmentalized: metabolite.bigg_id_compartmentalized,
				      node_type: 'metabolite' },
		    new_nodes = {};
		new_nodes[selected_node_id] = selected_node;
		break;
	    }
	}

	// draw
	extend_and_draw_metabolite(new_nodes, selected_node_id);

	// clone the nodes and reactions, to redo this action later
	var saved_nodes = utils.clone(new_nodes);

	// add to undo/redo stack
	o.undo_stack.push(function() {
	    // undo
	    // get the nodes to delete
	    delete_nodes(new_nodes);
	    // save the nodes and reactions again, for redo
	    new_nodes = utils.clone(saved_nodes);
	    // draw
	    draw_everything();
	}, function () {
	    // redo
	    // clone the nodes and reactions, to redo this action later
	    extend_and_draw_metabolite(new_nodes, selected_node_id);
	});
	
	// draw the reaction
	new_reaction_for_metabolite(starting_reaction, selected_node_id);

        // definitions
	function extend_and_draw_metabolite(new_nodes, selected_node_id) {
	    utils.extend(o.drawn_nodes, new_nodes);
	    draw_these_nodes([selected_node_id]);
	}
    }
    
    function new_reaction_for_metabolite(reaction_abbreviation, selected_node_id) {
	/** Build a new reaction starting with selected_met.

	 Undoable

	 */

        // If reaction id is not new, then return:
	for (var reaction_id in o.drawn_reactions) {
	    if (o.drawn_reactions[reaction_id].abbreviation == reaction_abbreviation) {             
		console.warn('reaction is already drawn');
                return;
	    }
        }

	// get the metabolite node
	var selected_node = o.drawn_nodes[selected_node_id];

        // set reaction coordinates and angle
        // be sure to copy the reaction recursively
        var cobra_reaction = utils.clone(o.cobra_reactions[reaction_abbreviation]);

	// build the new reaction
	var out = build.new_reaction(reaction_abbreviation, cobra_reaction,
				     selected_node_id, utils.clone(selected_node),
				     o.map_info.largest_ids, o.cofactors,
				     o.direction_arrow.get_rotation()),
	    new_nodes = out.new_nodes,
	    new_reactions = out.new_reactions;

	// add the flux
	if (o.flux) apply_flux_to_reactions(new_reactions);
	if (o.node_data) apply_node_data_to_nodes(new_nodes);

	// draw
	extend_and_draw_reaction(new_nodes, new_reactions, selected_node_id);

	// clone the nodes and reactions, to redo this action later
	var saved_nodes = utils.clone(new_nodes),
	    saved_reactions = utils.clone(new_reactions);

	// add to undo/redo stack
	o.undo_stack.push(function() {
	    // undo
	    // get the nodes to delete
	    delete new_nodes[selected_node_id];
	    delete_nodes(new_nodes);
	    delete_reactions(new_reactions);
	    select_metabolite_with_id(selected_node_id);
	    // save the nodes and reactions again, for redo
	    new_nodes = utils.clone(saved_nodes);
	    new_reactions = utils.clone(saved_reactions);
	    // draw
	    draw_everything();
	}, function () {
	    // redo
	    // clone the nodes and reactions, to redo this action later
	    extend_and_draw_reaction(new_nodes, new_reactions, selected_node_id);
	});

	// definitions
	function extend_and_draw_reaction(new_nodes, new_reactions, selected_node_id) {
	    utils.extend(o.drawn_reactions, new_reactions);
	    // remove the selected node so it can be updated
	    delete o.drawn_nodes[selected_node_id];
	    utils.extend(o.drawn_nodes, new_nodes);

	    // draw new reaction and (TODO) select new metabolite
	    draw_these_nodes(Object.keys(new_nodes));
	    draw_these_reactions(Object.keys(new_reactions));

	    // select new primary metabolite
	    for (var node_id in new_nodes) {
		var node = new_nodes[node_id];
		if (node.node_is_primary && node_id!=selected_node_id) {
		    select_metabolite_with_id(node_id);
		    var new_coords = { x: node.x, y: node.y };
		    translate_off_screen(new_coords);
		}
	    }
	}
	
    }

    function segments_and_reactions_for_nodes(nodes) {
	/** Get segments and reactions that should be deleted with node deletions
	 */
	var segment_objs_w_segments = [], reactions = {}, nodes_for_reactions = {};
	// for each node
	for (var node_id in nodes) {
	    var node = nodes[node_id];
	    // find associated segments and reactions	    
	    node.connected_segments.forEach(function(segment_obj) {
		var reaction = o.drawn_reactions[segment_obj.reaction_id],
		    segment = reaction.segments[segment_obj.segment_id],
		    segment_obj_w_segment = utils.clone(segment_obj);
		segment_obj_w_segment['segment'] = utils.clone(segment);
		segment_objs_w_segments.push(segment_obj_w_segment);
		if (!(segment_obj.reaction_id in nodes_for_reactions))
		    nodes_for_reactions[segment_obj.reaction_id] = 0;
		nodes_for_reactions[segment_obj.reaction_id]++;
	    });
	}
	// find the reactions that should be deleted because they have no segments left
	for (var reaction_id in nodes_for_reactions) {
	    var reaction = o.drawn_reactions[reaction_id];
	    if (Object.keys(reaction.segments).length == nodes_for_reactions[reaction_id])
		reactions[reaction_id] = reaction;
	}
	return { segment_objs_w_segments: segment_objs_w_segments, reactions: reactions };
    }
    function delete_nodes(nodes) {
	/** delete nodes
	 */
	for (var node_id in nodes) {
	    delete o.drawn_nodes[node_id];
	}
    }
    function delete_nodes_by_id(node_ids) {
	/** delete nodes for an array of ids
	 */
	node_ids.forEach(function(node_id) {
	    delete o.drawn_nodes[node_id];
	});
    }

    function delete_segments(segment_objs) {
	/** Delete segments, and update connected_segments in nodes. Also
	 deletes any reactions with 0 segments.
	 
	 segment_objs: Array of objects with { reaction_id: "123", segment_id: "456" }
	 
	 */
	segment_objs.forEach(function(segment_obj) {
	    var reaction = o.drawn_reactions[segment_obj.reaction_id],
		segment = reaction.segments[segment_obj.segment_id];

	    // updated connected nodes
	    [segment.from_node_id, segment.to_node_id].forEach(function(node_id) {
		if (!(node_id in o.drawn_nodes)) return;
		var node = o.drawn_nodes[node_id],
		    connected_segments = node.connected_segments;
		connected_segments = connected_segments.filter(function(so) {
		    return so.segment_id != segment_obj.segment_id;				
		});
	    });

	    delete reaction.segments[segment_obj.segment_id];
	});
    }
    function delete_reactions(reactions) {
	/** delete reactions
	 */
	for (var reaction_id in reactions) {
	    delete o.drawn_reactions[reaction_id];
	}
    }

    function set_status(status) {
        // TODO put this in js/metabolic-map/utils.js
        var t = d3.select('body').select('#status');
        if (t.empty()) t = d3.select('body')
            .append('text')
            .attr('id', 'status');
        t.text(status);
        return this;
    }

    function translate_off_screen(coords) {
        // shift window if new reaction will draw off the screen
        // TODO BUG not accounting for scale correctly
        var margin = 80, // pixels
	    current = {'x': {'min': - o.window_translate.x / o.window_scale + margin / o.window_scale,
                             'max': - o.window_translate.x / o.window_scale + (o.width-margin) / o.window_scale },
                       'y': {'min': - o.window_translate.y / o.window_scale + margin / o.window_scale,
                             'max': - o.window_translate.y / o.window_scale + (o.height-margin) / o.window_scale } };
        if (o.scale.x(coords.x) < current.x.min) {
            o.window_translate.x = o.window_translate.x - (o.scale.x(coords.x) - current.x.min) * o.window_scale;
            go();
        } else if (o.scale.x(coords.x) > current.x.max) {
            o.window_translate.x = o.window_translate.x - (o.scale.x(coords.x) - current.x.max) * o.window_scale;
            go();
        }
        if (o.scale.y(coords.y) < current.y.min) {
            o.window_translate.y = o.window_translate.y - (o.scale.y(coords.y) - current.y.min) * o.window_scale;
            go();
        } else if (o.scale.y(coords.y) > current.y.max) {
            o.window_translate.y = o.window_translate.y - (o.scale.y(coords.y) - current.y.max) * o.window_scale;
            go();
        }

	// definitions
        function go() {
            o.zoom_container.translate([o.window_translate.x, o.window_translate.y]);
            o.zoom_container.scale(o.window_scale);
            o.sel.transition()
                .attr('transform', 'translate('+o.window_translate.x+','+o.window_translate.y+')scale('+o.window_scale+')');
        }
    }

});
