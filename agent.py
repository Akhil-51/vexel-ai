import os
import requests
import random
from datetime import datetime
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.tools import tool
from langchain_core.messages import AIMessage, ToolMessage
import wikipedia

# ---- CONFIG ----
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# ---- STEP 1: SET UP THE LLM (THE BRAIN) ----
llm = ChatGroq(
    groq_api_key=GROQ_API_KEY,
    model_name="llama-3.3-70b-versatile",
    temperature=0,
    max_retries=3
)

# ---- STEP 2: DEFINE TOOLS (THE HANDS) ----
search_tool = DuckDuckGoSearchRun()

@tool
def web_search(query: str) -> str:
    """Searches the internet for current information, facts, or news."""
    return search_tool.run(query)

@tool
def calculator(expression: str) -> str:
    """Evaluates a safe math expression like '25 * 4' and returns the result."""
    import ast
    import operator as op

    allowed_ops = {
        ast.Add: op.add,
        ast.Sub: op.sub,
        ast.Mult: op.mul,
        ast.Div: op.truediv,
        ast.Pow: op.pow,
        ast.USub: op.neg,
        ast.UAdd: op.pos,
    }

    def safe_eval(node):
        if isinstance(node, ast.Constant):
            return node.n
        elif isinstance(node, ast.BinOp):
            left = safe_eval(node.left)
            right = safe_eval(node.right)
            op_type = type(node.op)
            if op_type not in allowed_ops:
                raise ValueError(f"Unsupported operator: {op_type}")
            return allowed_ops[op_type](left, right)
        elif isinstance(node, ast.UnaryOp):
            operand = safe_eval(node.operand)
            op_type = type(node.op)
            if op_type not in allowed_ops:
                raise ValueError(f"Unsupported operator: {op_type}")
            return allowed_ops[op_type](operand)
        else:
            raise ValueError(f"Unsupported expression type: {type(node)}")

    try:
        tree = ast.parse(expression, mode='eval')
        result = safe_eval(tree.body)
        return str(result)
    except Exception as e:
        return f"Error calculating: {e}"

@tool
def wikipedia_search(topic: str) -> str:
    """Searches Wikipedia for a summary about a topic, person, place, or historical event."""
    try:
        summary = wikipedia.summary(topic, sentences=4)
        return summary
    except wikipedia.exceptions.DisambiguationError as e:
        return f"Multiple results found, please be more specific. Options: {e.options[:5]}"
    except wikipedia.exceptions.PageError:
        return "No Wikipedia page found for this topic."
    except Exception as e:
        return f"Error searching Wikipedia: {e}"

@tool
def get_weather(city: str) -> str:
    """Gets the current weather for a given city name."""
    try:
        url = f"https://wttr.in/{city}?format=%C+%t+%h+%w"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return f"Weather in {city}: {response.text.strip()}"
        else:
            return f"Could not fetch weather for {city}."
    except Exception as e:
        return f"Error fetching weather: {e}"

@tool
def currency_converter(query: str) -> str:
    """Converts currency. Input format: 'amount from_currency to to_currency', e.g. '100 USD to INR'."""
    try:
        parts = query.upper().replace(" TO ", " ").split()
        amount = float(parts[0])
        from_curr = parts[1]
        to_curr = parts[2]
        url = f"https://api.exchangerate-api.com/v4/latest/{from_curr}"
        response = requests.get(url, timeout=10)
        data = response.json()
        rate = data["rates"][to_curr]
        result = amount * rate
        return f"{amount} {from_curr} = {result:.2f} {to_curr} (rate: {rate})"
    except Exception as e:
        return f"Error converting currency: {e}. Make sure format is like '100 USD to INR'."

@tool
def unit_converter(query: str) -> str:
    """Converts units. Supports: km to miles, miles to km, kg to lbs, lbs to kg, celsius to fahrenheit, fahrenheit to celsius. Input format: 'value unit to unit', e.g. '10 km to miles'."""
    try:
        query = query.lower()
        parts = query.replace(" to ", " ").split()
        value = float(parts[0])
        from_unit = parts[1]
        to_unit = parts[2]

        conversions = {
            ("km", "miles"): lambda x: x * 0.621371,
            ("miles", "km"): lambda x: x * 1.60934,
            ("kg", "lbs"): lambda x: x * 2.20462,
            ("lbs", "kg"): lambda x: x * 0.453592,
            ("celsius", "fahrenheit"): lambda x: (x * 9/5) + 32,
            ("fahrenheit", "celsius"): lambda x: (x - 32) * 5/9,
        }

        key = (from_unit, to_unit)
        if key in conversions:
            result = conversions[key](value)
            return f"{value} {from_unit} = {result:.2f} {to_unit}"
        else:
            return f"Conversion from {from_unit} to {to_unit} not supported. Supported: km/miles, kg/lbs, celsius/fahrenheit."
    except Exception as e:
        return f"Error converting units: {e}. Use format like '10 km to miles'."

@tool
def news_headlines(topic: str) -> str:
    """Fetches recent news headlines about a topic or country using web search."""
    try:
        results = search_tool.run(f"latest news {topic}")
        return results
    except Exception as e:
        return f"Error fetching news: {e}"

@tool
def date_calculator(query: str) -> str:
    """Calculates days between dates or what day of the week a date falls on. Input examples: 'days until 2026-12-25' or 'today'."""
    try:
        today = datetime.now()
        if "today" in query.lower():
            return f"Today's date is {today.strftime('%A, %B %d, %Y')}"
        if "days until" in query.lower():
            date_str = query.lower().replace("days until", "").strip()
            target = datetime.strptime(date_str, "%Y-%m-%d")
            diff = (target - today).days
            return f"There are {diff} days until {date_str}"
        return "Please use format 'days until YYYY-MM-DD' or ask for 'today'."
    except Exception as e:
        return f"Error with date calculation: {e}"

@tool
def random_fact(dummy: str = "") -> str:
    """Returns a random interesting fact. No input needed."""
    facts = [
        "Honey never spoils if stored properly.",
        "Octopuses have three hearts.",
        "Bananas are berries, but strawberries aren't.",
        "A day on Venus is longer than a year on Venus.",
        "The Eiffel Tower can grow taller in summer due to heat expansion.",
        "Sharks existed before trees.",
        "A group of flamingos is called a 'flamboyance'.",
    ]
    return random.choice(facts)

tools = [
    web_search, calculator, wikipedia_search, get_weather,
    currency_converter, unit_converter, news_headlines,
    date_calculator, random_fact
]

# ---- STEP 3: CREATE THE AGENT (THE ORCHESTRATOR) ----
system_prompt = """You are a helpful research assistant with access to 9 tools:
1. web_search - for current events or anything time-sensitive
2. calculator - for math expressions, e.g. calculator(expression='25 * 4')
3. wikipedia_search - for established facts, history, biographies, places
4. get_weather - for current weather in any city
5. currency_converter - for converting money, e.g. '100 USD to INR'
6. unit_converter - for converting units like km/miles, kg/lbs, celsius/fahrenheit
7. news_headlines - for recent news on any topic
8. date_calculator - for date math and today's date
9. random_fact - for a fun random fact

Always think step by step. Pick the most appropriate tool for each part of the question. If a question needs multiple tools, use them one at a time in logical order."""

agent = create_react_agent(
    model=llm,
    tools=tools,
    prompt=system_prompt
)

# ---- STEP 4: RUN THE AGENT ----
if __name__ == "__main__":
    print("=" * 60)
    print("RESEARCH AGENT - Ask me anything!")
    print("Tools: Search, Calculator, Wikipedia, Weather, Currency,")
    print("       Units, News, Dates, Random Facts")
    print("Type 'exit' to quit")
    print("=" * 60)

    while True:
        user_input = input("\nYou: ")
        if user_input.lower() == "exit":
            print("Goodbye!")
            break

        print("\nAgent is thinking...\n")
        try:
            response = agent.invoke({"messages": [{"role": "user", "content": user_input}]})

            for msg in response["messages"]:
                if isinstance(msg, ToolMessage):
                    print(f"Tool Result: {msg.content}\n")
                elif isinstance(msg, AIMessage) and msg.content:
                    print(f"Thought: {msg.content}\n")

            final_message = response["messages"][-1]
            print(f"Final Answer: {final_message.content}")
        except Exception as e:
            print(f"The agent hit an error. Try rephrasing your question!\nError: {e}")
