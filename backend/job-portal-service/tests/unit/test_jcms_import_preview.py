from app.api.v1.endpoints.jcms_facade import _preview_student_rows


def test_import_preview_marks_invalid_and_valid_rows():
    result = _preview_student_rows(
        [
            {"email": "ok@college.edu", "full_name": "Asha Rao", "program": "B.Tech"},
            {"email": "bad", "full_name": ""},
        ]
    )
    assert result["total_rows"] == 2
    assert result["valid_count"] == 1
    assert result["error_count"] == 1
    assert result["valid_rows"][0]["email"] == "ok@college.edu"
    assert result["rows"][1]["valid"] is False
