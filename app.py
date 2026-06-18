import os
import traceback
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        from agent import agent
        from langchain_core.messages import AIMessage, ToolMessage

        data = request.json
        user_message = data.get("message", "")

        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        response = agent.invoke({
            "messages": [{"role": "user", "content": user_message}]
        })

        tools_used = []
        final_answer = ""

        for msg in response["messages"]:
            if isinstance(msg, ToolMessage):
                tname = msg.name if hasattr(msg, "name") else "web_search"
                if tname not in tools_used:
                    tools_used.append(tname)
            elif isinstance(msg, AIMessage) and msg.content:
                final_answer = msg.content

        return jsonify({
            "answer": final_answer,
            "tools": tools_used
        })

    except Exception as e:
        error_details = traceback.format_exc()
        print("CHAT ERROR:\n", error_details)
        return jsonify({"error": str(e), "details": error_details}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting on port {port}")
    app.run(debug=False, host="0.0.0.0", port=port)