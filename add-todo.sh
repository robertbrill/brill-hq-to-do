#!/bin/bash
# Add a task to the todo inbox(es).
# Usage: ./add-todo.sh "task description" [priority] [project] [notes]
# Priority: urgent, high, normal (default), low
# Project: optional — when given, the dashboard files the task into that
#          project under the "AI Projects" section (creating it if needed)
#          instead of the flat inbox.
#
# Examples:
#   ./add-todo.sh "Call Brad Weber back" urgent "Client Calls"
#   ./add-todo.sh "Research semantic links strategy" normal "Marketing"
#   ./add-todo.sh "Get scratched lens replaced" low "Errands" "Lens from the X100V"

INBOX_PATHS=(
  "/Users/robert/AI-Brill-todo-live/todo-inbox.json"
  "/Users/robert/Library/CloudStorage/Dropbox-Advertising/C Boyle/AI-Brill/todo-inbox.json"
)

if [ -z "$1" ]; then
  echo "Usage: add-todo.sh \"task description\" [urgent|high|normal|low] [project] [notes]"
  exit 1
fi

TASK="$1"
PRIORITY="${2:-normal}"
PROJECT="${3:-}"
NOTES="${4:-}"

append_item() {
  local inbox_path="$1"

  mkdir -p "$(dirname "$inbox_path")"

  python3 - "$inbox_path" "$TASK" "$PRIORITY" "$PROJECT" "$NOTES" <<'PY'
import json
import sys
from datetime import datetime
from pathlib import Path

path = Path(sys.argv[1])
task = sys.argv[2]
priority = sys.argv[3]
project = sys.argv[4].strip() if len(sys.argv) > 4 else ""
notes = sys.argv[5].strip() if len(sys.argv) > 5 else ""

def load_items():
    try:
        with path.open("r", encoding="utf-8") as f:
            items = json.load(f)
            if isinstance(items, list):
                return items
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return []

items = load_items()

entry = {
    "task": task,
    "priority": priority,
    "added": datetime.now().strftime("%Y-%m-%d %I:%M %p")
}
if project:
    entry["project"] = project
if notes:
    entry["notes"] = notes

# Avoid duplicate exact entries while still allowing repeated asks if wording changes.
signature = (entry["task"].strip(), entry["priority"], entry.get("project", ""))
if not any(isinstance(i, dict) and (i.get("task", "").strip(), i.get("priority", "normal"), i.get("project", "")) == signature for i in items):
    items.append(entry)

with path.open("w", encoding="utf-8") as f:
    json.dump(items, f, indent=2)

print(f"{path}: {len(items)}")
PY
}

for path in "${INBOX_PATHS[@]}"; do
  append_item "$path"
done

if [ -n "$PROJECT" ]; then
  echo "Added (${PRIORITY}) to AI project \"${PROJECT}\": ${TASK}"
else
  echo "Added (${PRIORITY}) to inbox: ${TASK}"
fi
echo "Updated ${#INBOX_PATHS[@]} inbox file(s)"
