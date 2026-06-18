import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from agent import agent
from langchain_core.messages import AIMessage, ToolMessage

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

@app.route("/")
def home():
    return app.send_static_file("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message", "")

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    try:
        response = agent.invoke({
            "messages": [{"role": "user", "content": user_message}]
        })

        tools_used = []
        final_answer = ""

        for msg in response["messages"]:
            if isinstance(msg, ToolMessage):
                # Extract which tool was called
                tname = msg.name if hasattr(msg, "name") else "web_search"
                tools_used.append(tname)
            elif isinstance(msg, AIMessage) and msg.content:
                final_answer = msg.content

        return jsonify({
            "answer": final_answer,
            "tools": tools_used
        })

    except Exception as e:
        import traceback
        print("CHAT ERROR:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("=" * 50)
    print("Research Agent API running at http://localhost:5000")
    print("=" * 50)
    port = int(os.environ.get("PORT", 5000))
app.run(debug=False, host="0.0.0.0", port=port)
