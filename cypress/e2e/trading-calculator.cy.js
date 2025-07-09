// Trading Calculator page E2E test
describe('Trading Calculator Page', () => {
  it('should load the trading calculator page and display calculator UI', () => {
    cy.visit('frontend/trading-calculator.html');
    cy.get('form, #calculator, .calculator').should('exist');
    cy.get('input').should('exist');
    cy.get('button').should('exist');
  });
}); 