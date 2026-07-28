# Sommelier Mock Exam

고명외식고 소믈리에 2급 자격증 필기 대비(Created by 지명T)

PC · 모바일 브라우저용 웹 모의고사 (`sommelier-mock-exam`)

NCP-MCI Trainer Web과 동일한 방식 · 문제만 소믈리에 필기 핵심문제로 교체

## 접속 주소
https://ybs8625-cmd.github.io/sommelier-mock-exam/

레포: https://github.com/ybs8625-cmd/sommelier-mock-exam

## 폴더
- `index.html` — 진입점
- `styles.css` — 반응형 스타일
- `app.js` — 기능 로직
- `questions.json` — 문제 데이터 (2.txt → 1.txt 순, 선택지 1/2/3/4)

## 로컬에서 보기
```bash
cd sommelier-mock-exam
python -m http.server 8766
```
브라우저: http://127.0.0.1:8766/

## 기능
- 시험/공부 모드
- 오답노트만 풀기, 섞기, 뒤에서부터
- PASS, 미선택 넘기기 → 오답 누적
- 오답 리포트 (보기/삭제)
- 글씨 크기, PC 단축키(← → Space)
- 통계는 브라우저 localStorage에 저장
