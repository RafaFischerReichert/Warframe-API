// Login page E2E test
describe('Login Page', () => {
  it('should load the login page and display the login form', () => {
    cy.visit('frontend/login.html');
    cy.get('form').should('exist');
    cy.get('input[type="text"]').should('exist');
    cy.get('input[type="password"]').should('exist');
    cy.get('button[type="submit"]').should('exist');
  });
}); 