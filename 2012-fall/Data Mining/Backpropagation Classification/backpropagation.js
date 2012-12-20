var Backprogation = (function () {

    // use sigmoid as transfer function
    function f(x) {
        return 1 / (1 + Math.exp(-x));
    }
    function df(y) {
        return y * (1 - y);
    }

    var LEARNING_RATE = 0.9;

    function Backprogation(layers) {
        this.layers = layers;
        var weights = this.weights = [[]];
        var biases  = this.biases  = [[]];
        // random initialize
        for (var l = 1; l < layers.length; l++) {
            var weight = [],
                bias = [];
            for (var i = 0; i < layers[l]; i++) {
                var w = [];
                for (var j = 0; j < layers[l - 1]; j++)
                    w.push(Math.random());
                weight.push(w);
                bias.push(Math.random());
            }
            weights.push(weight);
            biases.push(bias);
        }
    }

    Backprogation.prototype.simulate = function (input) {
        var inputs = this.inputs = [input],
            outputs = this.outputs = [input],
            layers = this.layers;
        for (var l = 1; l < layers.length; l++) {
            var output = outputs[l - 1],
                input = [],
                weight = this.weights[l],
                bias = this.biases[l];
            // weighted sum
            for (var i = 0; i < layers[l]; i++) {
                var inp = 0;
                for (var j = 0; j < layers[l - 1]; j++)
                    inp += weight[i][j] * output[j];
                input.push(inp + bias[i]);
            }
            // transfer
            output = [];
            for (var i = 0; i < layers[l]; i++)
                output.push(f(input[i]));
            // store
            inputs.push(input);
            outputs.push(output);
        }
        return outputs[layers.length - 1];
    };

    Backprogation.prototype.backpropage = function (target) {
        var errs = this.errs = [],
            layers = this.layers,
            number = layers.length;

        var output = this.outputs[number - 1];
        for (var i = 0; i < number; i++)
            errs.push([]);
        for (var i = 0; i < layers[number - 1]; i++)
            errs[number - 1].push(df(output[i]) * (target[i] - output[i]));

        for (var l = number - 2; l > 0; l--) {
            var output = this.outputs[l],
                weight = this.weights[l + 1];
            for (var i = 0; i < layers[l]; i++) {
                var err = 0;
                for (var j = 0; j < layers[l + 1]; j++)
                    err += errs[l + 1][j] * weight[j][i];
                errs[l].push(df(output[i]) * err);
            }
        }
    };

    Backprogation.prototype.update = function () {
        var layers = this.layers,
            weights = this.weights,
            biases = this.biases,
            outputs = this.outputs,
            errs = this.errs;

        for (var l = 1; l < layers.length; l++) {
            var weight = weights[l],
                output = outputs[l - 1],
                bias = biases[l],
                err = errs[l];
            for (var i = 0; i < layers[l]; i++) {
                for (var j = 0; j < layers[l - 1]; j++)
                    weight[i][j] += LEARNING_RATE * err[i] * output[j];
                bias[i] += LEARNING_RATE * err[i];
            }
        }
    };

    Backprogation.prototype.train = function (input, target) {
        this.simulate(input);
        this.backpropage(target);
        this.update();
    };

    return Backprogation;
})();
