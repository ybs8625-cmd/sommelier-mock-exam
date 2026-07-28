# 소믈리에 자격증_필기 핵심문제(2026 문제포함)

PC · 모바일 브라우저용 웹 모의고사 (`sommelier-mock-exam`)

NCP-MCI Trainer Web과 동일한 방식 · 문제만 소믈리에 필기 핵심문제로 교체

## 폴더
- `index.html` — 진입점
- `styles.css` — 반응형 스타일
- `app.js` — 기능 로직
- `questions.json` — 문제 데이터 (1.txt + 2.txt)

## 로컬에서 보기
```bash
cd sommelier-mock-exam
python -m http.server 8766
```
브라우저: http://127.0.0.1:8766/

같은 Wi-Fi면 아이폰 Safari에서 `http://(PC아이피):8766/` 로 접속 가능.

## 기능
- 시험/공부 모드
- 오답노트만 풀기, 섞기, 뒤에서부터
- PASS, 미선택 넘기기 → 오답 누적
- 오답 리포트 (보기/삭제)
- 글씨 크기, PC 단축키(← → Space)
- 통계는 브라우저 localStorage에 저장
