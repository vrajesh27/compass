var d3 = require('d3');
var _ = require('lodash');
var $ = require('jquery');
var tooltipHtml = require('./tooltip.jade');
var shared = require('./shared');
var debug = require('debug')('scout:minicharts:few');

require('../d3-tip')(d3);

var minicharts_d3fns_few_new = function() {
  // --- beginning chart setup ---
  var width = 420;
  var height = 80;
  var barHeight = 25;
  var options = {
    view: null
  };

  var xScale = d3.scale.linear();

  // set up tooltips
  var tip = d3.tip()
    .attr('class', 'd3-tip')
    .direction('n')
    .offset([-9, 0]);

  // --- end chart setup ---

  var handleClick = function(d, i) {
    if (!options.view) return;
    var fgRect = $(this).siblings('rect.fg')[0];
    var evt = {
      d: d,
      i: i,
      self: fgRect,
      all: options.view.queryAll('rect.fg'),
      evt: d3.event,
      type: 'click',
      source: 'few'
    };
    options.view.trigger('querybuilder', evt);
  };

  function chart(selection) {
    selection.each(function(data) {
      var values = _.pluck(data, 'count');
      var sumValues = d3.sum(values);
      var maxValue = d3.max(values);
      var percentFormat = shared.friendlyPercentFormat(maxValue / sumValues * 100);

      xScale
        .domain([0, sumValues])
        .range([0, width]);

      // setup tool tips
      tip.html(function(d, i) {
        if (typeof d.tooltip === 'function') {
          return d.tooltip(d, i);
        }
        return d.tooltip || tooltipHtml({
            label: shared.truncateTooltip(d.label),
            count: percentFormat(d.count / sumValues * 100, false)
          });
      });
      this.call(tip);

      // select all g.bar elements
      var bar = this.selectAll('g.bar')
        .data(data, function(d) {
          return d.label;  // identify data by its label
        });

      bar
        .transition()  // only apply transition to already existing bars
        .attr('transform', function(d, i) {
          var xpos = _.sum(_(data)
            .slice(0, i)
            .pluck('count')
            .value()
          );
          return 'translate(' + xScale(xpos) + ', ' + (height - barHeight) / 2 + ')';
        });

      var barEnter = bar.enter().append('g')
        .attr('class', 'bar few')
        .attr('transform', function(d, i) { // repeat transform attr here but without transition
          var xpos = _.sum(_(data)
            .slice(0, i)
            .pluck('count')
            .value()
          );
          return 'translate(' + xScale(xpos) + ', ' + (height - barHeight) / 2 + ')';
        });


      barEnter.append('rect')
        .attr('class', function(d, i) {
          return 'fg fg-' + i;
        })
        .attr('y', 0)
        .attr('x', 0)
        .attr('height', barHeight);

      barEnter.append('text')
        .attr('y', barHeight / 2)
        .attr('dy', '0.3em')
        .attr('dx', 10)
        .attr('text-anchor', 'start')
        .attr('fill', 'white');

      barEnter.append('rect')
        .attr('class', 'glass')
        .attr('y', 0)
        .attr('x', 0)
        .attr('height', barHeight)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide)
        .on('click', handleClick);

      bar.select('rect.fg')
        .transition()
        .attr('width', function(d) {
          return xScale(d.count);
        });

      bar.select('rect.glass')
        .transition()
        .attr('width', function(d) {
          return xScale(d.count);
        });

      bar.select('text')
        .text(function(d) {
          return d.label;
        });

      bar.exit().remove();
    });
  }

  chart.width = function(value) {
    if (!arguments.length) return width;
    width = value;
    return chart;
  };

  chart.height = function(value) {
    if (!arguments.length) return height;
    height = value;
    return chart;
  };

  chart.options = function(value) {
    if (!arguments.length) return options;
    options = value;
    return chart;
  };

  return chart;
};

var minicharts_d3fns_few = function(data, view, g, width, height) {
  var handleClick = function(d, i) {
    var fgRect = $(this).siblings('rect.fg')[0];
    var evt = {
      d: d,
      i: i,
      self: fgRect,
      all: view.queryAll('rect.fg'),
      evt: d3.event,
      type: 'click',
      source: 'few'
    };
    view.trigger('querybuilder', evt);
  };

  var barHeight = 25;
  var values = _.pluck(data, 'count');
  var sumValues = d3.sum(values);
  var maxValue = d3.max(values);
  var percentFormat = shared.friendlyPercentFormat(maxValue / sumValues * 100);

  var x = d3.scale.linear()
    .domain([0, sumValues])
    .range([0, width]);

  // set up tooltips
  var tip = d3.tip()
    .attr('class', 'd3-tip')
    .html(function(d, i) {
      if (typeof d.tooltip === 'function') {
        return d.tooltip(d, i);
      }
      return d.tooltip || tooltipHtml({
          label: shared.truncateTooltip(d.label),
          count: percentFormat(d.count / sumValues * 100, false)
        });
    })
    .direction('n')
    .offset([-9, 0]);

  // clear element first
  g.selectAll('*').remove();
  g.call(tip);

  var bar = g.selectAll('.bar')
    .data(data)
    .enter().append('g')
    .attr('class', 'bar few')
    .attr('transform', function(d, i) {
      var xpos = _.sum(_(data)
        .slice(0, i)
        .pluck('count')
        .value()
      );
      return 'translate(' + x(xpos) + ', ' + (height - barHeight) / 2 + ')';
    });

  bar.append('rect')
    .attr('class', function(d, i) {
      return 'fg fg-' + i;
    })
    .attr('y', 0)
    .attr('x', 0)
    .attr('width', function(d) {
      return x(d.count);
    })
    .attr('height', barHeight);

  bar.append('text')
    .attr('y', barHeight / 2)
    .attr('dy', '0.3em')
    .attr('dx', 10)
    .attr('text-anchor', 'start')
    .text(function(d) {
      return d.label;
    })
    .attr('fill', 'white');

  bar.append('rect')
    .attr('class', 'glass')
    .attr('y', 0)
    .attr('x', 0)
    .attr('width', function(d) {
      return x(d.count);
    })
    .attr('height', barHeight)
    .on('mouseover', tip.show)
    .on('mouseout', tip.hide)
    .on('click', handleClick);
};

// module.exports = minicharts_d3fns_few;
module.exports.newFn = minicharts_d3fns_few_new;
