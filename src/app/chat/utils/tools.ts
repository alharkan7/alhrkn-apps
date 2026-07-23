import { SchemaType } from '@/lib/google-ai-proxy';
type Tool = any;

export const tools: Tool[] = [
    {
        functionDeclarations: [{
            name: "calculate",
            description: "Perform various mathematical calculations",
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    operation: {
                        type: SchemaType.STRING,
                        enum: [
                            "add", "subtract", "multiply", "divide",
                            "power", "sqrt", "cbrt",
                            "sin", "cos", "tan",
                            "asin", "acos", "atan",
                            "log", "ln",
                            "abs", "round", "ceil", "floor",
                            "factorial"
                        ],
                        description: "The mathematical operation to perform"
                    },
                    num1: {
                        type: SchemaType.NUMBER,
                        description: "First number (primary operand)"
                    },
                    num2: {
                        type: SchemaType.NUMBER,
                        description: "Second number (optional for some operations)"
                    }
                },
                required: ["operation", "num1"]
            }
        }]
    }
];

export function handleCalculate(params: any): number {
    const { operation, num1, num2 } = params;

    const factorial = (n: number): number => {
        if (!Number.isInteger(n) || n < 0) throw new Error('Factorial only works with non-negative integers');
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    };

    switch (operation) {
        // Basic arithmetic
        case 'add':
            return num1 + num2;
        case 'subtract':
            return num1 - num2;
        case 'multiply':
            return num1 * num2;
        case 'divide':
            if (num2 === 0) throw new Error('Division by zero');
            return num1 / num2;

        // Powers and roots
        case 'power':
            return Math.pow(num1, num2 ?? 2);
        case 'sqrt':
            if (num1 < 0) throw new Error('Cannot calculate square root of negative number');
            return Math.sqrt(num1);
        case 'cbrt':
            return Math.cbrt(num1);

        // Trigonometry (input in radians)
        case 'sin':
            return Math.sin(num1);
        case 'cos':
            return Math.cos(num1);
        case 'tan':
            return Math.tan(num1);
        case 'asin':
            return Math.asin(num1);
        case 'acos':
            return Math.acos(num1);
        case 'atan':
            return Math.atan(num1);

        // Logarithms
        case 'log':
            if (num1 <= 0) throw new Error('Cannot calculate logarithm of non-positive number');
            return Math.log10(num1);
        case 'ln':
            if (num1 <= 0) throw new Error('Cannot calculate natural logarithm of non-positive number');
            return Math.log(num1);

        // Other mathematical functions
        case 'abs':
            return Math.abs(num1);
        case 'round':
            return Math.round(num1);
        case 'ceil':
            return Math.ceil(num1);
        case 'floor':
            return Math.floor(num1);
        case 'factorial':
            return factorial(num1);

        default:
            throw new Error('Invalid operation');
    }
}