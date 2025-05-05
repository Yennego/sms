#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any

class ConfigValidator:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.task_manager_path = self.project_root / ".cursor" / "task-manager.json"
        self.cursor_config_path = self.project_root / ".cursor" / "config.json"
        self.task_md_path = self.project_root / "task.md"
        
    def validate_json_structure(self, file_path: Path, required_keys: List[str]) -> bool:
        """Validate JSON file structure and required keys."""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            missing_keys = [key for key in required_keys if key not in data]
            if missing_keys:
                print(f"❌ Missing required keys in {file_path.name}: {', '.join(missing_keys)}")
                return False
                
            return True
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in {file_path.name}: {str(e)}")
            return False
        except FileNotFoundError:
            print(f"❌ File not found: {file_path}")
            return False

    def validate_task_manager(self) -> bool:
        """Validate task-manager.json configuration."""
        required_keys = [
            "version",
            "project",
            "rules",
            "current_focus",
            "progress_tracking"
        ]
        
        if not self.validate_json_structure(self.task_manager_path, required_keys):
            return False
            
        try:
            with open(self.task_manager_path, 'r') as f:
                config = json.load(f)
                
            # Validate rules structure
            rules = config.get("rules", {})
            required_rule_sections = [
                "task_tracking",
                "code_quality",
                "git_workflow",
                "documentation",
                "testing",
                "security",
                "multi_tenant"
            ]
            
            missing_sections = [section for section in required_rule_sections 
                              if section not in rules]
            if missing_sections:
                print(f"❌ Missing rule sections in task-manager.json: {', '.join(missing_sections)}")
                return False
                
            # Validate status indicators
            status_indicators = config["rules"]["task_tracking"].get("status_indicators", {})
            required_indicators = ["completed", "pending", "in_progress"]
            missing_indicators = [indicator for indicator in required_indicators 
                                if indicator not in status_indicators]
            if missing_indicators:
                print(f"❌ Missing status indicators: {', '.join(missing_indicators)}")
                return False
                
            return True
        except Exception as e:
            print(f"❌ Error validating task-manager.json: {str(e)}")
            return False

    def validate_cursor_config(self) -> bool:
        """Validate config.json configuration."""
        required_keys = [
            "version",
            "project",
            "navigation",
            "code_style",
            "tasks",
            "multi_tenant"
        ]
        
        if not self.validate_json_structure(self.cursor_config_path, required_keys):
            return False
            
        try:
            with open(self.cursor_config_path, 'r') as f:
                config = json.load(f)
                
            # Validate project structure
            project = config.get("project", {})
            if not all(key in project for key in ["name", "type", "root", "ignore"]):
                print("❌ Missing required project configuration")
                return False
                
            # Validate multi-tenant components
            multi_tenant = config.get("multi_tenant", {})
            if not all(key in multi_tenant for key in ["key_components", "required_fields"]):
                print("❌ Missing required multi-tenant configuration")
                return False
                
            return True
        except Exception as e:
            print(f"❌ Error validating config.json: {str(e)}")
            return False

    def validate_task_md(self) -> bool:
        """Validate task.md file exists and has correct format."""
        if not self.task_md_path.exists():
            print("❌ task.md file not found")
            return False
            
        try:
            with open(self.task_md_path, 'r') as f:
                content = f.read()
                
            # Check for basic markdown structure
            if not content.strip():
                print("❌ task.md is empty")
                return False
                
            # Check for task sections
            if "## 1. Project Initialization" not in content:
                print("❌ Missing Project Initialization section in task.md")
                return False
                
            return True
        except Exception as e:
            print(f"❌ Error validating task.md: {str(e)}")
            return False

    def validate_project_structure(self) -> bool:
        """Validate that required directories exist."""
        required_dirs = [
            "src/db/models",
            "src/core",
            "src/api",
            "src/services",
            "tests"
        ]
        
        missing_dirs = []
        for dir_path in required_dirs:
            if not (self.project_root / dir_path).exists():
                missing_dirs.append(dir_path)
                
        if missing_dirs:
            print(f"❌ Missing required directories: {', '.join(missing_dirs)}")
            return False
            
        return True

    def run_validation(self) -> bool:
        """Run all validations and return overall status."""
        print("\n🔍 Starting configuration validation...\n")
        
        validations = [
            ("Task Manager Config", self.validate_task_manager),
            ("Cursor Config", self.validate_cursor_config),
            ("Task MD File", self.validate_task_md),
            ("Project Structure", self.validate_project_structure)
        ]
        
        all_valid = True
        for name, validator in validations:
            print(f"\nValidating {name}...")
            if validator():
                print(f"✅ {name} validation passed")
            else:
                print(f"❌ {name} validation failed")
                all_valid = False
                
        print("\n" + "="*50)
        if all_valid:
            print("✅ All validations passed successfully!")
        else:
            print("❌ Some validations failed. Please fix the issues above.")
            
        return all_valid

def main():
    validator = ConfigValidator(os.getcwd())
    if not validator.run_validation():
        sys.exit(1)

if __name__ == "__main__":
    main() 